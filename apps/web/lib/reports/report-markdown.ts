import "server-only";
import type { ReportAgentOutput } from "@/lib/validation/agent";
import type { ReportMetrics } from "@/lib/ai/agents/report-agent";

/**
 * SAD §9.4: "structured sections (Highlights, Risks, Recommendations) in
 * markdown, rendered to PDF downstream." Deterministic rendering — the
 * agent returns structured JSON (Zod-validated), and this function is the
 * one place that turns it into markdown, kept separate from the LLM call
 * so the document structure is consistent regardless of which path
 * produced the content (Claude or the template fallback).
 */
export function renderReportMarkdown(orgName: string, metrics: ReportMetrics, output: ReportAgentOutput): string {
  const section = (title: string, items: string[]): string =>
    items.length === 0 ? "" : `## ${title}\n\n${items.map((item) => `- ${item}`).join("\n")}\n\n`;

  return [
    `# Weekly Executive Report — ${orgName}`,
    `**Period:** ${metrics.periodStart} to ${metrics.periodEnd}`,
    "",
    "## Executive Summary",
    "",
    output.executiveSummary,
    "",
    output.trendComparison ? `**Trend:** ${output.trendComparison}\n` : "",
    section("Highlights", output.highlights),
    section("Risks", output.risks),
    section("Recommendations", output.recommendations),
    "## Metrics",
    "",
    `- Tasks created: ${metrics.tasksCreated}`,
    `- Tasks completed: ${metrics.tasksCompleted}`,
    `- Overdue tasks: ${metrics.overdueTasks}`,
    `- Active risks: ${metrics.activeRisksBySeverity.high} high, ${metrics.activeRisksBySeverity.medium} medium, ${metrics.activeRisksBySeverity.low} low`,
    `- Meetings processed: ${metrics.meetingsProcessed}`
  ]
    .filter((line) => line !== "")
    .join("\n");
}
