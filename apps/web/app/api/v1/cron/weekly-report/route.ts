import { NextRequest, NextResponse } from "next/server";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { generateReport, type GenerateReportResult } from "@/lib/reports/report-generation-service";

/**
 * SAD §8.5 Reporting Workflow — "Trigger: Cron (weekly, Friday 4pm
 * org-local time)." Vercel Cron schedules are fixed UTC times, not
 * per-org-timezone-aware — this route runs weekly (see /vercel.json) at a
 * single fixed UTC time as a documented simplification of "org-local
 * time," which would need per-org timezone storage this schema doesn't
 * have. Same `CRON_SECRET` bearer-token auth as Phase 5's risk-scan cron.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid cron secret" } }, { status: 401 });
  }

  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const orgIds = await OrganizationRepository.listAllIds();
  const results: (GenerateReportResult | { orgId: string; error: string })[] = [];

  for (const orgId of orgIds) {
    try {
      const result = await generateReport(orgId, { type: "weekly_exec", periodStart, periodEnd, generatedBy: "scheduled" });
      results.push(result);
    } catch (error) {
      console.error(`[cron/weekly-report] org ${orgId} failed`, error);
      results.push({ orgId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ generatedOrgs: orgIds.length, results });
}
