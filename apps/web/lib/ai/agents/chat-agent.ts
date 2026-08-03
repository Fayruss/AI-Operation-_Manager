import "server-only";
import { callClaudeJson, ClaudeApiError } from "@/lib/ai/claude-client";
import { loadPrompt } from "@/lib/ai/prompt-loader";
import { chatAgentOutputSchema } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";
import { UserRepository } from "@/lib/repositories/user-repository";
import { retrieveMemoryContext, formatMemoryContext } from "@/lib/memory/memory-retrieval-service";

/**
 * SAD §13.1 AI Chat Workspace — "a retrieval-orchestrating agent that: (1)
 * embeds the user's question, (2) runs similarity search over
 * memory_entries scoped to org_id, (3) pulls supplementary live rows (open
 * tasks, active risk_signals for entities mentioned), (4) composes a
 * Claude call with retrieved context, (5) returns a structured response
 * with inline entity references."
 *
 * Grounding strategy (Test Plan §4's "no fabricated entity IDs" eval):
 * this module builds a small, *numbered* candidate list of real rows
 * (tasks, risk signals, people) and asks the model to reference them only
 * by index. `resolveReferencedEntities` below then maps indices back to
 * real `{type, id, label}` records — an index the model didn't receive
 * literally cannot resolve to a fabricated ID, so grounding is enforced by
 * construction, not just by prompt instruction.
 */

export interface ChatCandidateEntity {
  index: number;
  type: "task" | "risk_signal" | "user";
  id: string;
  label: string;
  detail: string;
}

export interface ResolvedEntityReference {
  type: ChatCandidateEntity["type"];
  id: string;
  label: string;
}

export interface ChatAgentResult {
  agentRunId: string;
  answer: string;
  referencedEntities: ResolvedEntityReference[];
  proposedAction: { type: "notify_user"; targetUserId: string; targetUserName: string; summary: string } | null;
}

/** Naive but effective keyword extraction for the grounding search (TaskRepository.searchForGrounding) — strips common stopwords/short tokens so "the client redesign task" searches on "client"/"redesign"/"task" rather than noise. */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "for", "and", "or", "to", "of", "in", "on", "with",
  "about", "what", "who", "when", "where", "why", "how", "can", "you", "me", "my", "please", "tell",
  "show", "list", "any", "there", "this", "that", "it", "have", "has", "will", "would", "should"
]);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !STOPWORDS.has(word))
    )
  ).slice(0, 8);
}

async function buildCandidateEntities(orgId: string, questionText: string): Promise<ChatCandidateEntity[]> {
  const keywords = extractKeywords(questionText);

  const [tasks, riskSignals, users] = await Promise.all([
    TaskRepository.searchForGrounding(orgId, keywords, 8),
    RiskSignalRepository.listActiveForGrounding(orgId, 6),
    UserRepository.listByOrg(orgId)
  ]);

  const candidates: ChatCandidateEntity[] = [];
  let index = 0;

  for (const task of tasks) {
    candidates.push({
      index: index++,
      type: "task",
      id: task.id,
      label: task.title,
      detail: `status=${task.status}, priority=${task.priority}, assignee=${task.assignee?.name ?? "unassigned"}, dueDate=${task.dueDate?.toISOString().slice(0, 10) ?? "none"}`
    });
  }

  for (const signal of riskSignals) {
    candidates.push({
      index: index++,
      type: "risk_signal",
      id: signal.id,
      label: `${signal.signalType} on ${signal.entityType}`,
      detail: `severity=${signal.severity}, entityId=${signal.entityId}, createdAt=${signal.createdAt.toISOString().slice(0, 10)}`
    });
  }

  // Cap at a small number of people to keep the prompt bounded on larger orgs.
  for (const user of users.slice(0, 15)) {
    candidates.push({
      index: index++,
      type: "user",
      id: user.id,
      label: user.name,
      detail: `role=${user.role}, email=${user.email}`
    });
  }

  return candidates;
}

function formatCandidateBlock(candidates: ChatCandidateEntity[]): string {
  if (candidates.length === 0) return "No candidate entities found for this question.";
  return candidates.map((c) => `${c.index}. [${c.type}] ${c.label} — ${c.detail}`).join("\n");
}

function buildUserPrompt(
  questionText: string,
  contextLabel: string | null,
  candidates: ChatCandidateEntity[],
  memoryContext: string | null
): string {
  const lines = [
    contextLabel ? `The user is currently viewing: ${contextLabel}` : null,
    `Question: ${questionText}`,
    "",
    "Candidate entities (reference by index only):",
    formatCandidateBlock(candidates)
  ].filter((line): line is string => line !== null);

  if (memoryContext) {
    lines.push("", `Relevant organizational memory (most similar first):\n${memoryContext}`);
  }

  return lines.join("\n");
}

export async function runChatAgent(
  orgId: string,
  questionText: string,
  contextLabel: string | null
): Promise<ChatAgentResult> {
  const agentRun = await AgentRunRepository.start({
    orgId,
    agentName: "chat",
    triggerSource: "chat.message",
    input: { question: questionText, contextLabel }
  });

  const candidates = await buildCandidateEntities(orgId, questionText);

  // SAD §13.1: "cost and latency... The retrieval step is scoped by (a)
  // entities named/implied in the question and (b) recency/importance-
  // weighted memory, same pattern as Section 9's agents."
  const { items: memoryItems } = await retrieveMemoryContext(orgId, questionText, { topK: 6, minImportance: 0.3 });
  const memoryContext = formatMemoryContext(memoryItems);

  try {
    const { data, inputTokens, outputTokens } = await callClaudeJson({
      systemPrompt: loadPrompt("chat"),
      userPrompt: buildUserPrompt(questionText, contextLabel, candidates, memoryContext),
      schema: chatAgentOutputSchema,
      temperature: 0.3,
      maxTokens: 1024
    });

    const referencedEntities: ResolvedEntityReference[] = data.referenced_entity_indices
      .map((i) => candidates.find((c) => c.index === i))
      .filter((c): c is ChatCandidateEntity => c !== undefined)
      .map((c) => ({ type: c.type, id: c.id, label: c.label }));

    let proposedAction: ChatAgentResult["proposedAction"] = null;
    if (data.proposed_action) {
      const target = candidates.find((c) => c.index === data.proposed_action!.target_user_index && c.type === "user");
      if (target) {
        proposedAction = {
          type: "notify_user",
          targetUserId: target.id,
          targetUserName: target.label,
          summary: data.proposed_action.summary
        };
      }
      // If the model referenced an index that isn't a real user candidate,
      // the action is silently dropped rather than surfaced — same
      // grounding-by-construction principle as entity references above.
    }

    await AgentRunRepository.markSuccess(agentRun.id, {
      output: { answer: data.answer, referencedEntities, proposedAction },
      inputTokens,
      outputTokens,
      // SAD §13.4: rough estimate — a grounded answer replaces manually searching multiple screens.
      timeSavedMinutes: 4
    });

    return { agentRunId: agentRun.id, answer: data.answer, referencedEntities, proposedAction };
  } catch (error) {
    const message = error instanceof ClaudeApiError ? error.message : String(error);
    await AgentRunRepository.markFailed(agentRun.id, message);
    // Unlike Report Agent's guaranteed-non-empty fallback, there's no
    // meaningful template answer for an arbitrary question — the chat
    // service surfaces this as a retry-able inline error (Component Spec's
    // ChatPanel "error" state), matching the classifier's "fails to
    // status=unprocessed rather than fabricating an answer" precedent.
    throw new ClaudeApiError(`Chat Agent failed: ${message}`);
  }
}
