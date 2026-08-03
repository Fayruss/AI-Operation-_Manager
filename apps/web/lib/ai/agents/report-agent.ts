import "server-only";
import { callClaudeJson, ClaudeApiError } from "@/lib/ai/claude-client";
import { loadPrompt } from "@/lib/ai/prompt-loader";
import { reportAgentOutputSchema, type ReportAgentOutput } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { retrieveMemoryContext, formatMemoryContext } from "@/lib/memory/memory-retrieval-service";

/**
 * SAD §9.4 Report Agent — "Input: period metrics, top risks, completed
 * milestones, memory of prior report... Output: structured sections
 * (Highlights, Risks, Recommendations) in markdown, rendered to PDF
 * downstream... Retry: single retry; on failure falls back to a
 * template-based (non-LLM) metrics report so exec reporting never silently
 * fails to appear."
 */
export interface ReportMetrics {
  periodStart: string;
  periodEnd: string;
  tasksCreated: number;
  tasksCompleted: number;
  overdueTasks: number;
  activeRisksBySeverity: { high: number; medium: number; low: number };
  meetingsProcessed: number;
  projectHealthSummary: { name: string; health: string }[];
}

export interface RunReportAgentResult {
  agentRunId: string;
  output: ReportAgentOutput;
  usedFallback: boolean;
}

function buildUserPrompt(metrics: ReportMetrics, previousSummary: string | null, memoryContext: string | null): string {
  const lines = [
    `Period: ${metrics.periodStart} to ${metrics.periodEnd}`,
    `Tasks created: ${metrics.tasksCreated}`,
    `Tasks completed: ${metrics.tasksCompleted}`,
    `Overdue tasks: ${metrics.overdueTasks}`,
    `Active risks — high: ${metrics.activeRisksBySeverity.high}, medium: ${metrics.activeRisksBySeverity.medium}, low: ${metrics.activeRisksBySeverity.low}`,
    `Meetings processed: ${metrics.meetingsProcessed}`,
    `Project health: ${metrics.projectHealthSummary.map((p) => `${p.name} (${p.health})`).join(", ") || "no active projects"}`
  ];
  if (previousSummary) {
    lines.push(`Previous period's executive summary (for trend comparison only): ${previousSummary}`);
  }
  // SAD §9.4: "Input: ... memory of prior report (avoid repetitive
  // phrasing, show trend deltas)." `previousSummary` above (sourced
  // directly from the last `reports` row) already covers the immediate
  // prior period; this broader memory query surfaces older
  // organizational context (resolved risks, completed projects, meeting
  // decisions) that the Report Agent can reference for deeper trend
  // narrative without re-deriving it from raw metrics alone.
  if (memoryContext) {
    lines.push(`Relevant organizational memory from this period (most similar first):\n${memoryContext}`);
  }
  return lines.join("\n");
}

/** SAD §9.4's guaranteed-non-empty fallback — pure aggregation, no narrative, used when the Claude call fails entirely. */
export function generateTemplateReport(metrics: ReportMetrics): ReportAgentOutput {
  return {
    executiveSummary: `Automated summary for ${metrics.periodStart} to ${metrics.periodEnd}: ${metrics.tasksCompleted} of ${metrics.tasksCreated} tasks completed, ${metrics.overdueTasks} overdue, ${metrics.activeRisksBySeverity.high} high-severity risk(s) active.`,
    highlights: metrics.tasksCompleted > 0 ? [`${metrics.tasksCompleted} tasks completed this period.`] : [],
    risks:
      metrics.activeRisksBySeverity.high + metrics.activeRisksBySeverity.medium > 0
        ? [`${metrics.activeRisksBySeverity.high} high and ${metrics.activeRisksBySeverity.medium} medium severity risk signals are currently active.`]
        : [],
    recommendations: metrics.overdueTasks > 0 ? [`Review the ${metrics.overdueTasks} overdue task(s) and reassign or reschedule as needed.`] : [],
    trendComparison: null
  };
}

export async function runReportAgent(
  orgId: string,
  reportId: string,
  metrics: ReportMetrics,
  previousExecutiveSummary: string | null
): Promise<RunReportAgentResult> {
  const agentRun = await AgentRunRepository.start({
    orgId,
    agentName: "report",
    triggerSource: "report.generation",
    reportId,
    input: metrics
  });

  try {
    const { items: memoryItems } = await retrieveMemoryContext(
      orgId,
      `Executive summary for ${metrics.periodStart} to ${metrics.periodEnd}: risks, completed projects, key decisions`,
      { topK: 8, minImportance: 0.4 }
    );
    const memoryContext = formatMemoryContext(memoryItems);

    const { data, inputTokens, outputTokens } = await callClaudeJson({
      systemPrompt: loadPrompt("report"),
      userPrompt: buildUserPrompt(metrics, previousExecutiveSummary, memoryContext),
      schema: reportAgentOutputSchema,
      temperature: 0.4,
      maxTokens: 1536
    });

    await AgentRunRepository.markSuccess(agentRun.id, {
      output: data,
      inputTokens,
      outputTokens,
      // SAD §13.4: rough estimate — reading + assembling an exec summary manually.
      timeSavedMinutes: 20
    });

    return { agentRunId: agentRun.id, output: data, usedFallback: false };
  } catch (error) {
    const message = error instanceof ClaudeApiError ? error.message : String(error);
    const fallback = generateTemplateReport(metrics);
    // Fallback path still succeeds from the caller's perspective (a report
    // is always produced) — the agent_run itself records the underlying
    // failure so it's visible in the audit trail (SAD §9.4: "agent_runs
    // records both the attempt and... that the fallback path fired").
    await AgentRunRepository.markFailed(agentRun.id, message);
    return { agentRunId: agentRun.id, output: fallback, usedFallback: true };
  }
}
