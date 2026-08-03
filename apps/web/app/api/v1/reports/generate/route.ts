import { NextResponse, unstable_after as after } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { generateReportSchema } from "@/lib/validation/report";
import { createPendingReport, runReportPipeline } from "@/lib/reports/report-generation-service";

/**
 * API Contract Pattern B — `POST /reports/generate`: "202 Accepted (job
 * enqueued, not complete)... admin+ only... max 5 manual generations/
 * hour/org — cost governance." Mirrors the email/meeting webhooks' `after()`
 * pattern: create the `generating` row synchronously so the poll endpoint
 * (`GET /reports/:id`) has a real id immediately, then run the actual
 * aggregation + Claude + PDF pipeline off the request path.
 */
export const POST = apiRoute(
  async (request, ctx) => {
    checkRateLimit(`${ctx.orgId}:report-generate`, 5, 60 * 60 * 1000);

    const input = await parseJsonBody(request, generateReportSchema);
    const report = await createPendingReport(ctx.orgId, {
      type: input.type,
      generatedBy: "manual",
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd)
    });

    after(async () => {
      try {
        await runReportPipeline(ctx.orgId, report);
      } catch (error) {
        console.error("[reports/generate] background generation failed", error);
      }
    });

    return NextResponse.json({ reportId: report.id, status: "generating", pollUrl: `/api/v1/reports/${report.id}` }, { status: 202 });
  },
  { minRole: "admin" }
);
