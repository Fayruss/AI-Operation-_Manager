import "server-only";
import type { Report } from "@ai-ops/database";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { ReportRepository } from "@/lib/repositories/report-repository";
import { NotificationRepository } from "@/lib/repositories/notification-repository";
import { UserRepository } from "@/lib/repositories/user-repository";
import { runReportAgent, type ReportMetrics } from "@/lib/ai/agents/report-agent";
import { renderReportMarkdown } from "@/lib/reports/report-markdown";
import { generateReportPdfBuffer } from "@/lib/reports/report-pdf";
import { uploadReportPdf } from "@/lib/storage/report-storage";
import { reportAgentOutputSchema } from "@/lib/validation/agent";
import type { ReportType, ReportGeneratedBy } from "@ai-ops/database";

/**
 * SAD §2.5/§8.5 Reporting Workflow — direct-invocation stand-in for the n8n
 * Reporting Workflow (n8n Workflow Spec §5): aggregate period metrics →
 * Report Agent → render markdown → PDF → store → notify subscribers.
 * "Retry: single retry on the Claude call only" is handled inside
 * claude-client's own transient-failure retry (Phase 4); this service's
 * job is orchestration and the guaranteed-non-empty-report fallback
 * contract (SAD §9.4).
 *
 * Split into `createPendingReport` + `runReportPipeline` (rather than one
 * function that always does both) specifically so `POST /reports/generate`
 * (API Contract Pattern B: "202 Accepted... pollUrl") can create the row
 * synchronously — returning a real `reportId` immediately — and run the
 * actual pipeline afterward via `after()`, without creating two rows for
 * one request. `generateReport` below is the convenience wrapper for
 * callers (the cron route) that don't need that synchronous/async split.
 *
 * Idempotency: `ReportRepository.create` always makes a new row per call —
 * there is no natural dedup key for "generate a report" the way there is
 * for risk signals (an entity+signalType pair) or email ingestion
 * (Idempotency-Key header on the API route, applied at that layer instead).
 */

export interface GenerateReportResult {
  reportId: string;
  status: "complete" | "complete_fallback";
}

export async function createPendingReport(
  orgId: string,
  input: { type: ReportType; periodStart: Date; periodEnd: Date; generatedBy: ReportGeneratedBy }
): Promise<Report> {
  return ReportRepository.create(orgId, input);
}

/** Runs the aggregation → Report Agent → PDF → store → notify pipeline against an already-created `Report` row. */
export async function runReportPipeline(orgId: string, report: Report): Promise<GenerateReportResult> {
  if (!report.periodStart || !report.periodEnd) {
    // Schema-level nullability exists because SAD §4 doesn't mandate these
    // columns be required, but this pipeline can't run without a period —
    // every creation path (createPendingReport, the cron route) always
    // supplies one, so reaching this is a genuine programming error, not a
    // user-facing validation case.
    throw new Error(`Report ${report.id} has no period set — cannot run the generation pipeline.`);
  }

  const org = await OrganizationRepository.getById(orgId);

  try {
    const [taskMetrics, overdueTasks, highRisks, mediumRisks, lowRisks, meetingsProcessed, projectScores, previousReport] = await Promise.all([
      TaskRepository.getMetricsForPeriod(orgId, report.periodStart, report.periodEnd),
      TaskRepository.countOverdue(orgId),
      RiskSignalRepository.countActive(orgId, "high"),
      RiskSignalRepository.countActive(orgId, "medium"),
      RiskSignalRepository.countActive(orgId, "low"),
      MeetingRepository.countInPeriod(orgId, report.periodStart, report.periodEnd),
      ProjectRepository.listWithHealthScores(orgId),
      ReportRepository.findMostRecentCompleted(orgId, report.type)
    ]);

    const metrics: ReportMetrics = {
      periodStart: report.periodStart.toISOString().slice(0, 10),
      periodEnd: report.periodEnd.toISOString().slice(0, 10),
      tasksCreated: taskMetrics.created,
      tasksCompleted: taskMetrics.completed,
      overdueTasks,
      activeRisksBySeverity: { high: highRisks, medium: mediumRisks, low: lowRisks },
      meetingsProcessed,
      projectHealthSummary: projectScores.map((p) => ({ name: p.name, health: p.health }))
    };

    const previousSummary = previousReport
      ? (() => {
          const parsed = reportAgentOutputSchema.safeParse(previousReport.content);
          return parsed.success ? parsed.data.executiveSummary : null;
        })()
      : null;

    const { output, usedFallback } = await runReportAgent(orgId, report.id, metrics, previousSummary);

    // Markdown is stored alongside the structured JSON so GET /reports/:id
    // can offer a plain-text/markdown view in addition to the PDF — not
    // just computed and discarded.
    const markdown = renderReportMarkdown(org.name, metrics, output);

    const pdfBuffer = await generateReportPdfBuffer({ orgName: org.name, metrics, output, usedFallback });
    const pdfUrl = await uploadReportPdf(orgId, report.id, pdfBuffer);

    const status = usedFallback ? "complete_fallback" : "complete";
    await ReportRepository.markComplete(report.id, { status, content: { ...output, markdown }, pdfUrl });

    await notifySubscribers(orgId, report.id, status);

    return { reportId: report.id, status };
  } catch (error) {
    await ReportRepository.markFailed(report.id);
    throw error;
  }
}

/** Convenience wrapper for callers that don't need the create/run split (the cron route). */
export async function generateReport(
  orgId: string,
  input: { type: ReportType; periodStart: Date; periodEnd: Date; generatedBy: ReportGeneratedBy }
): Promise<GenerateReportResult> {
  const report = await createPendingReport(orgId, input);
  return runReportPipeline(orgId, report);
}

/** SAD §8.5: "render to PDF → store, notify subscribers." Subscribers = org admins/owners (no separate subscription list exists — same fallback recipient set as Phase 5's risk notifications). */
async function notifySubscribers(orgId: string, reportId: string, status: "complete" | "complete_fallback"): Promise<void> {
  const admins = await UserRepository.listAdmins(orgId);
  await NotificationRepository.createMany(
    orgId,
    admins.map((admin) => ({
      userId: admin.id,
      type: "report.generated",
      payload: {
        title: status === "complete" ? "Weekly report ready" : "Weekly report ready (template fallback)",
        description: status === "complete_fallback" ? "AI narrative was unavailable this run — metrics-only report generated." : "Your executive report has been generated.",
        href: `/app/reports/${reportId}`
      }
    }))
  );
}
