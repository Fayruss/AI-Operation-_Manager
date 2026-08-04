import "server-only";
import type { EmailMessage } from "@ai-ops/database";
import { callClaudeJson, ClaudeApiError } from "@/lib/ai/claude-client";
import { loadPrompt } from "@/lib/ai/prompt-loader";
import { classifierOutputSchema, type ClassifierOutput } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { retrieveMemoryContext, formatMemoryContext } from "@/lib/memory/memory-retrieval-service";
import { requiresHumanApproval } from "@/lib/ai/confidence-routing";

/**
 * SAD §9.1 Classifier Agent. This is the direct-invocation stand-in for
 * n8n Workflow Spec §1 nodes 3–5 (normalize → Classifier Agent call → IF
 * branch) — n8n itself is out of scope for this phase, so the orchestration
 * (retry via claude-client, logging via AgentRunRepository, branching on
 * confidence) happens in this service module instead. A future phase that
 * introduces n8n can call this exact function from an HTTP node without
 * changing its contract.
 *
 * SAD §9.1 "temperature low (0–0.3) for classification" — 0.2 default from
 * claude-client is used as-is.
 */
export interface RunClassifierInput {
  orgId: string;
  emailMessage: Pick<EmailMessage, "id" | "sender" | "subject" | "bodySnippet">;
}

export interface RunClassifierResult {
  agentRunId: string;
  output: ClassifierOutput;
  requiresApproval: boolean;
}

function buildUserPrompt(input: RunClassifierInput, memoryContext: string | null): string {
  return [
    `Sender: ${input.emailMessage.sender}`,
    `Subject: ${input.emailMessage.subject}`,
    `Body: ${input.emailMessage.bodySnippet ?? "(no body available)"}`,
    memoryContext ? `Relevant sender/organizational history (most similar first):\n${memoryContext}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runClassifierAgent(
  input: RunClassifierInput,
  confidenceThreshold: number
): Promise<RunClassifierResult> {
  const agentRun = await AgentRunRepository.start({
    orgId: input.orgId,
    agentName: "classifier",
    triggerSource: "email.received",
    input: { emailMessageId: input.emailMessage.id, sender: input.emailMessage.sender, subject: input.emailMessage.subject },
    emailMessageId: input.emailMessage.id
  });

  try {
    // SAD §9.1: "reads recent memory entries for the sender (past
    // complaints, VIP status)." Memory entries about email/person entities
    // aren't strictly scoped to one sender's entityId (see
    // memory-consolidation-service.ts's `entityType: "person"` candidates,
    // which are org-wide), so this is a general semantic query over
    // sender+subject rather than an exact entityId filter — the embedding
    // similarity search is what surfaces sender-relevant history.
    const { items: memoryItems } = await retrieveMemoryContext(
      input.orgId,
      `Email from ${input.emailMessage.sender}: ${input.emailMessage.subject}`,
      { sourceType: "email", topK: 5 }
    );
    const memoryContext = formatMemoryContext(memoryItems);

    const { data, inputTokens, outputTokens } = await callClaudeJson({
      systemPrompt: loadPrompt("classifier"),
      userPrompt: buildUserPrompt(input, memoryContext),
      schema: classifierOutputSchema,
      temperature: 0.2
    });

    const requiresApproval = requiresHumanApproval({
      confidence: data.confidence,
      intent: data.intent,
      threshold: confidenceThreshold
    });

    if (requiresApproval) {
      await AgentRunRepository.markAwaitingApproval(agentRun.id, {
        output: data,
        confidence: data.confidence,
        rationale: data.rationale,
        inputTokens,
        outputTokens
      });
    } else {
      await AgentRunRepository.markSuccess(agentRun.id, {
        output: data,
        confidence: data.confidence,
        rationale: data.rationale,
        // SAD §13.4: "email triage saves ~3 min of human read/route time" — the documented default constant.
        timeSavedMinutes: 3,
        inputTokens,
        outputTokens
      });
    }

    return { agentRunId: agentRun.id, output: data, requiresApproval };
  } catch (error) {
    const message = error instanceof ClaudeApiError ? error.message : String(error);
    await AgentRunRepository.markFailed(agentRun.id, message);
    throw error;
  }
}
