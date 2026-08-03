import { PageHeader } from "@/components/shared/page-header";
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog";
import { ReportsList } from "@/components/reports/reports-list";
import { getAuthContext } from "@/lib/auth/session";
import { ReportRepository } from "@/lib/repositories/report-repository";
import type { ReportDto } from "@/lib/api/dto";

/**
 * SAD §7.6 Reports Dashboard — "Report history table, scheduled report
 * config, on-demand generate, PDF export." Server Component fetches the
 * initial page (no loading flash); ReportsList + GenerateReportDialog are
 * Client Components for live status/polling (API Contract Pattern B).
 */
export default async function ReportsPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Sign in to view reports." />
      </div>
    );
  }

  const reportsPage = await ReportRepository.list(ctx.orgId, {}, null, 50);

  // Server → Client boundary: DTO shape (ISO strings), matching what the
  // API route itself returns after NextResponse.json() serialization —
  // same reasoning as the Operations Dashboard's risk feed (Phase 5).
  const initialData = {
    items: reportsPage.items.map(
      (report): ReportDto => ({
        id: report.id,
        orgId: report.orgId,
        type: report.type,
        status: report.status,
        content: report.content as unknown as ReportDto["content"],
        pdfUrl: report.pdfUrl,
        generatedBy: report.generatedBy,
        periodStart: report.periodStart?.toISOString() ?? null,
        periodEnd: report.periodEnd?.toISOString() ?? null,
        createdAt: report.createdAt.toISOString()
      })
    ),
    nextCursor: reportsPage.nextCursor
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Report history, on-demand generation, PDF export."
        actions={<GenerateReportDialog />}
      />
      <ReportsList initialData={initialData} />
    </div>
  );
}
