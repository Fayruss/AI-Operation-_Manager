import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { runRiskScanForOrg } from "@/lib/risk/risk-detection-service";

/**
 * Manual on-demand trigger for the caller's own org — useful for testing
 * and for an admin who doesn't want to wait for the next scheduled cycle
 * (`GET /api/v1/cron/risk-scan` runs this for every org on a schedule).
 * Idempotent by construction (RiskSignalRepository.findActiveForEntity) —
 * re-running immediately after a scan just finds nothing new to report.
 */
export const POST = apiRoute(
  async (_request, ctx) => {
    const result = await runRiskScanForOrg(ctx.orgId);
    return NextResponse.json(result);
  },
  { minRole: "admin" }
);
