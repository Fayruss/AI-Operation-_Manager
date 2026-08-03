import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { ReportRepository } from "@/lib/repositories/report-repository";
import { getSignedReportPdfUrl } from "@/lib/storage/report-storage";

/**
 * "Download endpoint" (Phase 6 scope), distinct from the `pdfUrl` returned
 * by `GET /reports/:id`: that field may hold a signed URL generated at
 * report-completion time and could be stale by the time someone clicks
 * download (Supabase signed URLs expire) — this route always mints a fresh
 * one and redirects, so the link never goes dead.
 */
export const GET = apiRoute<{ id: string }>(
  async (_request, ctx, { id }) => {
    const report = await ReportRepository.getByIdInOrg(ctx.orgId, id);
    if (report.status !== "complete" && report.status !== "complete_fallback") {
      throw new ApiError("VALIDATION_ERROR", "This report hasn't finished generating yet.");
    }

    const signedUrl = await getSignedReportPdfUrl(ctx.orgId, report.id);
    return NextResponse.redirect(signedUrl);
  },
  { minRole: "admin" }
);
