import "server-only";
import { callClaudeJson, ClaudeApiError } from "@/lib/ai/claude-client";
import { loadPrompt } from "@/lib/ai/prompt-loader";
import { riskAgentOutputSchema, type RiskAgentOutput } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { retrieveMemoryContext, formatMemoryContext } from "@/lib/memory/memory-retrieval-service";
import type { RiskSeverity } from "@ai-ops/database";

/**
 * SAD §9.3 Risk Agent — "chain-of-thought suppressed in output (reasoning
 * kept server-side only, final structured verdict returned)... idempotent —
 * safe to re-run; failures simply skip that cycle's signal."
 *
 * n8n Workflow Spec §4: "one agent_runs row per cycle covering all
 * candidates scored in that run (batched, not per-candidate, to avoid
 * agent_runs bloat at 15-min cadence)" — this is the one Claude call for
 * the whole scan, not one per candidate.
 */
export interface RiskCandidateInput {
  signalType: "stale_task" | "sla_breach" | "velocity_drop";
  entityLabel: string;
  severity: RiskSeverity;
  detail: Record<string, unknown>;
}

export interface RunRiskAgentResult {
  agentRunId: string;
  output: RiskAgentOutput;
}

function buildUserPrompt(candidates: RiskCandidateInput[], memoryByIndex: (string | null)[]): string {
  return candidates
    .map((c, i) => {
      const history = memoryByIndex[i];
      return [
        `Candidate ${i} — type: ${c.signalType}, entity: "${c.entityLabel}", severity: ${c.severity}, detail: ${JSON.stringify(c.detail)}`,
        history ? `  Historical incidents on this entity (most similar first): ${history.replace(/\n/g, " | ")}` : null
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

/**
 * Returns `null` if there are no candidates (nothing to score — n8n
 * Workflow Spec §4's "idempotent by design" means an empty cycle just
 * isn't logged, matching the "avoid agent_runs bloat" rationale above).
 */
export async function runRiskAgent(orgId: string, candidates: RiskCandidateInput[]): Promise<RunRiskAgentResult | null> {
  if (candidates.length === 0) return null;

  const agentRun = await AgentRunRepository.start({
    orgId,
    agentName: "risk",
    triggerSource: "risk.scheduled_scan",
    input: { candidateCount: candidates.length, signalTypes: candidates.map((c) => c.signalType) }
  });

  try {
    // SAD §9.3: "Input: aggregated project metrics + relevant memory (past
    // incidents on this project)." One retrieval call per candidate,
    // scoped to that candidate's entity — batched into the single Claude
    // call below per n8n Workflow Spec §4's "one agent_runs row per cycle"
    // batching contract (memory retrieval itself isn't logged per-call,
    // only the resulting Claude call is).
    //
    // Performance note: this issues one embedding-API call per candidate
    // (via retrieveMemoryContext) rather than one batched call for all of
    // them — retrieveMemoryContext's contract (shared by every agent) is
    // single-query-in, so batching would mean giving it a batch mode just
    // for this call site. Acceptable because Risk Detection candidates per
    // 15-minute cycle are bounded by real signal (stale tasks/SLA
    // breaches/velocity drops that exist right now), not by unbounded
    // input, and the embedding client already retries transient failures.
    // Worth revisiting only if real deployments show risk cycles with
    // dozens+ of simultaneous candidates.
    const memoryByIndex = await Promise.all(
      candidates.map(async (c) => {
        const { items } = await retrieveMemoryContext(orgId, `${c.signalType} risk on ${c.entityLabel}`, { sourceType: "risk_signal", topK: 3 });
        return formatMemoryContext(items);
      })
    );

    const { data, inputTokens, outputTokens } = await callClaudeJson({
      systemPrompt: loadPrompt("risk"),
      userPrompt: buildUserPrompt(candidates, memoryByIndex),
      schema: riskAgentOutputSchema,
      temperature: 0.2,
      maxTokens: Math.max(1024, candidates.length * 150)
    });

    await AgentRunRepository.markSuccess(agentRun.id, {
      output: data,
      inputTokens,
      outputTokens,
      // SAD §13.4: rough estimate — reading + triaging N risk signals manually.
      timeSavedMinutes: candidates.length * 2
    });

    return { agentRunId: agentRun.id, output: data };
  } catch (error) {
    const message = error instanceof ClaudeApiError ? error.message : String(error);
    await AgentRunRepository.markFailed(agentRun.id, message);
    throw error;
  }
}
