import "server-only";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import type { AgentName } from "@ai-ops/database";

/**
 * SAD §13.4 Time-Saved/ROI Metrics — "Computed, not estimated by an LLM —
 * trust requires this to be auditable math." Every figure here traces
 * directly to a `agent_runs.time_saved_minutes` sum or a `tasks.source`
 * count — no LLM call in this module.
 */
export interface RoiMetrics {
  periodDays: number;
  hourlyCostUsd: number;
  totalMinutesSaved: number;
  totalHoursSaved: number;
  estimatedValueUsd: number;
  tasksAutomated: number;
  emailsProcessed: number;
  meetingsSummarized: number;
  reportsGenerated: number;
  riskScansSaved: number;
  byAgent: { agentName: AgentName; runCount: number; minutesSaved: number }[];
}

const AGENT_MINUTES: Record<AgentName, "emailsProcessed" | "meetingsSummarized" | "reportsGenerated" | "riskScansSaved" | "other"> = {
  classifier: "emailsProcessed",
  summarizer: "meetingsSummarized",
  risk: "riskScansSaved",
  report: "reportsGenerated",
  reply_draft: "other",
  memory: "other",
  chat: "other"
};

export async function computeRoiMetrics(orgId: string, periodDays: number): Promise<RoiMetrics> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [byAgent, tasksAutomated, org] = await Promise.all([
    AgentRunRepository.getRoiAggregateSince(orgId, since),
    TaskRepository.countAutomatedSince(orgId, since),
    OrganizationRepository.getById(orgId)
  ]);

  const totalMinutesSaved = byAgent.reduce((sum, a) => sum + a.minutesSaved, 0);
  const byLabel = (label: (typeof AGENT_MINUTES)[AgentName]) =>
    byAgent.filter((a) => AGENT_MINUTES[a.agentName] === label).reduce((sum, a) => sum + a.runCount, 0);

  const hourlyCostUsd = Number(org.roiHourlyCostUsd);
  const totalHoursSaved = totalMinutesSaved / 60;

  return {
    periodDays,
    hourlyCostUsd,
    totalMinutesSaved,
    totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
    estimatedValueUsd: Math.round(totalHoursSaved * hourlyCostUsd),
    tasksAutomated,
    emailsProcessed: byLabel("emailsProcessed"),
    meetingsSummarized: byLabel("meetingsSummarized"),
    reportsGenerated: byLabel("reportsGenerated"),
    riskScansSaved: byLabel("riskScansSaved"),
    byAgent
  };
}
