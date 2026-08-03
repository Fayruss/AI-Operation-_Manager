import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, History, Lightbulb, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ActionTimeline } from "@/components/shared/action-timeline";
import { CopilotButton } from "@/components/copilot/copilot-button";
import { getAuthContext } from "@/lib/auth/session";
import { ReportRepository } from "@/lib/repositories/report-repository";
import { getActionTimeline } from "@/lib/timeline/action-timeline-service";
import { reportAgentOutputSchema } from "@/lib/validation/agent";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";

/** SAD §7.6 "Report preview." Server Component — a report's content is immutable once complete, no interactivity needed beyond the download link. */
export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) notFound();

  const report = await ReportRepository.getByIdInOrg(ctx.orgId, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!report) notFound();

  if (report.status === "generating") {
    return (
      <div className="space-y-6">
        <PageHeader title="Report" description="Still generating…" />
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={TrendingUp} title="Generating…" description="Refresh in a moment — this usually takes under a minute." />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (report.status === "failed") {
    return (
      <div className="space-y-6">
        <PageHeader title="Report" description="Generation failed" />
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={AlertTriangle} title="Generation failed" description="Check Settings → Audit Log for details, or generate a new report." />
          </CardContent>
        </Card>
      </div>
    );
  }

  const parsed = reportAgentOutputSchema.safeParse(report.content);
  if (!parsed.success) notFound();
  const content = parsed.data;
  const timelineEvents = await getActionTimeline(ctx.orgId, "report", id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${report.type.replace("_", " ")} report`.replace(/^\w/, (c) => c.toUpperCase())}
        description={
          report.periodStart && report.periodEnd
            ? `${report.periodStart.toISOString().slice(0, 10)} to ${report.periodEnd.toISOString().slice(0, 10)}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <CopilotButton
              entityType="report"
              entityId={report.id}
              entityLabel={`${report.type.replace("_", " ")} report`}
              quickPrompts={["What changed since the last report?", "Which risk needs attention first?", "Draft a one-line summary for Slack"]}
            />
            {report.pdfUrl && (
              <a href={`/api/v1/reports/${report.id}/download`} className={cn(buttonVariants())}>
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            )}
          </div>
        }
      />

      {report.status === "complete_fallback" && (
        <Badge variant="warning">AI narrative unavailable this run — metrics-only report</Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{content.executiveSummary}</p>
          {content.trendComparison && <p className="mt-3 text-sm text-muted-foreground">Trend: {content.trendComparison}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content.highlights.length === 0 ? (
              <p className="text-xs text-muted-foreground">None this period.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {content.highlights.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content.risks.length === 0 ? (
              <p className="text-xs text-muted-foreground">None this period.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {content.risks.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4 text-info" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {content.recommendations.length === 0 ? (
              <p className="text-xs text-muted-foreground">None this period.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {content.recommendations.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Action Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionTimeline
            events={timelineEvents.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
