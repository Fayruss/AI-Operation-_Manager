import { NextRequest, NextResponse } from "next/server";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { runConsolidationForOrg, type ConsolidationResult } from "@/lib/memory/memory-consolidation-service";

/**
 * SAD §8.6 Memory Consolidation workflow — "Trigger: Cron, nightly." Same
 * Vercel Cron entry-point pattern as risk-scan/weekly-report (n8n isn't
 * connected in this environment; see those routes' doc comments for the
 * full rationale). `CRON_SECRET` bearer-token auth, identical convention.
 *
 * n8n Workflow Spec §6: "partial success is acceptable and expected — a
 * failed batch simply means slightly stale memory until the next run,
 * never a hard failure surfaced to users." That's handled *inside*
 * `runConsolidationForOrg` (embedding batch failures don't throw); this
 * loop's own try/catch is for a harder failure in candidate-gathering
 * itself, matching risk-scan/weekly-report's "one org's failure doesn't
 * block the others" fan-out pattern.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid cron secret" } }, { status: 401 });
  }

  const orgIds = await OrganizationRepository.listAllIds();
  const results: (ConsolidationResult | { orgId: string; error: string })[] = [];

  for (const orgId of orgIds) {
    try {
      results.push(await runConsolidationForOrg(orgId));
    } catch (error) {
      console.error(`[cron/memory-consolidation] org ${orgId} failed`, error);
      results.push({ orgId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ consolidatedOrgs: orgIds.length, results });
}
