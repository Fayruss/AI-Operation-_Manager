import "server-only";
import type { z } from "zod";
import { withRetry } from "@/lib/api/retry";

/**
 * SAD §3.2: "Claude API called only from n8n/server contexts, never
 * client-side... every agent call pass through the orchestration layer for
 * logging/retry/cost governance." This phase has no n8n, so this module
 * (server-only) is the orchestration boundary instead — AgentRunRepository
 * (lib/repositories/agent-run-repository.ts) provides the logging half.
 *
 * SAD §9: "structured JSON output (enforced via system prompt + schema
 * validation on response)... on schema-validation failure, one repair
 * attempt with the error appended to the prompt, then fallback."
 * n8n Workflow Spec §1 node 4 / §3: transient failures (network/5xx/429)
 * get "3 attempts, exponential backoff (2s/8s/32s)" — a distinct retry
 * concern from the schema-repair loop below, handled via lib/api/retry.ts.
 */
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest";
const MAX_REPAIR_ATTEMPTS = 1;

export interface ClaudeJsonCallInput<Schema extends z.ZodTypeAny> {
  systemPrompt: string;
  userPrompt: string;
  schema: Schema;
  /** SAD §9: "temperature low (0–0.3) for classification/extraction agents." */
  temperature?: number;
  maxTokens?: number;
}

export interface ClaudeJsonCallResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
}

export class ClaudeApiError extends Error {
  constructor(message: string, readonly retryable: boolean = false, readonly cause?: unknown) {
    super(message);
    this.name = "ClaudeApiError";
  }
}

interface AnthropicMessageResponse {
  content: { type: string; text?: string }[];
  usage: { input_tokens: number; output_tokens: number };
}

/** 429 (rate limit) and 5xx (server-side) are transient — everything else (401/403/400) is not. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function callAnthropicOnce(systemPrompt: string, userPrompt: string, temperature: number, maxTokens: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeApiError("ANTHROPIC_API_KEY is not set (see .env.example)", false);
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
  } catch (error) {
    // Network-level failure (DNS, timeout, connection reset) — always retryable.
    throw new ClaudeApiError(`Claude API network error: ${error instanceof Error ? error.message : String(error)}`, true, error);
  }

  if (!response.ok) {
    const retryable = isRetryableStatus(response.status);
    throw new ClaudeApiError(`Claude API request failed: ${response.status} ${await response.text()}`, retryable);
  }

  return (await response.json()) as AnthropicMessageResponse;
}

/** Wraps a single Claude call with the n8n-spec retry cadence, retrying only marked-retryable failures. */
async function callAnthropic(systemPrompt: string, userPrompt: string, temperature: number, maxTokens: number) {
  return withRetry(() => callAnthropicOnce(systemPrompt, userPrompt, temperature, maxTokens), {
    shouldRetry: (error) => error instanceof ClaudeApiError && error.retryable
  });
}

function extractText(response: AnthropicMessageResponse): string {
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new ClaudeApiError("Claude response contained no text content block");
  }
  return textBlock.text;
}

function parseJsonLoose(text: string): unknown {
  // Models sometimes wrap JSON in ```json fences despite instructions — strip defensively.
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Calls Claude, expecting a JSON-only response validated against `schema`.
 * On a schema-validation (or JSON-parse) failure, makes exactly one repair
 * attempt with the validation error appended to the prompt (SAD §9.1),
 * then throws `ClaudeApiError` — the caller (an agent module) is
 * responsible for its own failure path (AgentRunRepository.markFailed).
 */
export async function callClaudeJson<Schema extends z.ZodTypeAny>(
  input: ClaudeJsonCallInput<Schema>
): Promise<ClaudeJsonCallResult<z.infer<Schema>>> {
  const temperature = input.temperature ?? 0.2;
  const maxTokens = input.maxTokens ?? 1024;
  let lastError: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const userPrompt =
      attempt === 0
        ? input.userPrompt
        : `${input.userPrompt}\n\nYour previous response failed schema validation with this error:\n${lastError}\n\nRespond again with ONLY valid JSON matching the required schema, no other text.`;

    const response = await callAnthropic(input.systemPrompt, userPrompt, temperature, maxTokens);
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    try {
      const parsed = parseJsonLoose(extractText(response));
      const data = input.schema.parse(parsed);
      return { data, inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new ClaudeApiError(`Claude response failed schema validation after repair attempt: ${lastError}`);
}
