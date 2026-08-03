import { NextRequest, NextResponse } from "next/server";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { runRiskScanForOrg, type RiskScanResult } from "@/lib/risk/risk-detection-service";

/**
 * SAD §8.4 Risk Detection Workflow — "Trigger: Cron node, every 15
 * minutes." This is the Vercel Cron entry point (see /vercel.json for the
 * schedule expression) standing in for n8n's Cron trigger node, since n8n
 * itself isn't connected in this environment.
 *
 * Auth: `CRON_SECRET` bearer token, Vercel Cron's documented convention —
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
 * scheduled invocations. Iterates every org; one org's failure doesn't
 * block the others (n8n Workflow Spec §4: "single-cycle misses are
 * expected/tolerated").
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid cron secret" } }, { status: 401 });
  }

  const orgIds = await OrganizationRepository.listAllIds();
  const results: (RiskScanResult | { orgId: string; error: string })[] = [];

  for (const orgId of orgIds) {
    try {
      results.push(await runRiskScanForOrg(orgId));
    } catch (error) {
      console.error(`[cron/risk-scan] org ${orgId} failed`, error);
      results.push({ orgId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ scannedOrgs: orgIds.length, results });
}
