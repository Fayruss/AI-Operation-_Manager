import "server-only";
import { withRetry } from "@/lib/api/retry";

/**
 * SAD §2.6: "embedding generation... Claude API (embeddings via a
 * dedicated embedding call or Voyage-style embedding model)." Anthropic's
 * Messages API doesn't itself expose an embeddings endpoint, so this is a
 * distinct HTTP integration from claude-client.ts (which retains its own
 * copy of the retry/error-handling pattern rather than sharing a client —
 * intentional: request/response shapes are entirely different between
 * "chat completion" and "embeddings," and the two APIs have independent
 * failure modes/rate limits worth logging separately).
 *
 * `EmbeddingProvider` is the seam CLAUDE.md's "embedding service
 * abstraction" (Phase 7 requirement §2) requires: today there's one
 * implementation (Voyage AI, Anthropic's recommended embedding partner —
 * https://docs.anthropic.com/en/docs/build-with-claude/embeddings), but
 * nothing in the pipeline (memory-entry-repository, embedding-pipeline,
 * memory-retrieval-service) depends on Voyage specifically.
 */
export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  /** Schema/versioning field (Phase 7 requirement §2) — bumped by changing EMBEDDING_MODEL_VERSION below, never inferred from the provider response. */
  version: number;
  tokensUsed: number;
}

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<EmbeddingResult>;
}

export class EmbeddingApiError extends Error {
  constructor(message: string, readonly retryable: boolean = false, readonly cause?: unknown) {
    super(message);
    this.name = "EmbeddingApiError";
  }
}

/** `memory_entries.embedding` is declared `vector(1536)` (SAD §4's literal schema) — every provider implementation must produce exactly this many dimensions. */
export const MEMORY_EMBEDDING_DIMENSIONS = 1536;

/** Bump on any change to the embedding model/prompt-adjacent config that would make old vectors incomparable to new ones — drives MemoryEntryRepository.listStaleEmbeddings for the rebuild endpoint. */
export const EMBEDDING_MODEL_VERSION = 1;

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_VOYAGE_MODEL = "voyage-3-large"; // 1536 dimensions, matches MEMORY_EMBEDDING_DIMENSIONS.
const MAX_BATCH_SIZE = 20; // Phase 7 requirement §2/§3: "batches of 20," matching n8n Workflow Spec §6's documented cadence.

interface VoyageEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions = MEMORY_EMBEDDING_DIMENSIONS;

  constructor(model: string = process.env.EMBEDDING_MODEL ?? DEFAULT_VOYAGE_MODEL) {
    this.model = model;
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], model: this.model, version: EMBEDDING_MODEL_VERSION, tokensUsed: 0 };
    }
    if (texts.length > MAX_BATCH_SIZE) {
      throw new EmbeddingApiError(`embed() called with ${texts.length} texts, exceeding the ${MAX_BATCH_SIZE}-item batch limit — callers must chunk first (see embedding-pipeline.ts).`);
    }

    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new EmbeddingApiError("VOYAGE_API_KEY is not set (see .env.example) — the embedding pipeline cannot run.", false);
    }

    const response = await withRetry(() => this.callOnce(apiKey, texts), {
      shouldRetry: (error) => error instanceof EmbeddingApiError && error.retryable
    });

    if (response.data.length !== texts.length) {
      throw new EmbeddingApiError(`Embedding provider returned ${response.data.length} vectors for ${texts.length} inputs.`);
    }

    // Provider returns items with an `index` field — sort defensively
    // rather than assuming response order matches request order.
    const embeddings = [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);

    for (const vector of embeddings) {
      if (vector.length !== this.dimensions) {
        throw new EmbeddingApiError(`Embedding provider returned ${vector.length} dimensions, expected ${this.dimensions} (memory_entries.embedding is vector(${this.dimensions})).`);
      }
    }

    return { embeddings, model: response.model, version: EMBEDDING_MODEL_VERSION, tokensUsed: response.usage.total_tokens };
  }

  private async callOnce(apiKey: string, texts: string[]): Promise<VoyageEmbeddingResponse> {
    let response: Response;
    try {
      response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ input: texts, model: this.model, input_type: "document", output_dimension: this.dimensions })
      });
    } catch (error) {
      throw new EmbeddingApiError(`Embedding API network error: ${error instanceof Error ? error.message : String(error)}`, true, error);
    }

    if (!response.ok) {
      const retryable = isRetryableStatus(response.status);
      throw new EmbeddingApiError(`Embedding API request failed: ${response.status} ${await response.text()}`, retryable);
    }

    return (await response.json()) as VoyageEmbeddingResponse;
  }
}

let cachedProvider: EmbeddingProvider | null = null;

/** Singleton accessor — mirrors claude-client.ts's module-level pattern; swapping providers means changing this one function, never the call sites. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!cachedProvider) {
    cachedProvider = new VoyageEmbeddingProvider();
  }
  return cachedProvider;
}
