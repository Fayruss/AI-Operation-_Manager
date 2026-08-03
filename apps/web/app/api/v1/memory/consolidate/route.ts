import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { runConsolidationForOrg } from "@/lib/memory/memory-consolidation-service";

/**
 * Manual consolidation trigger (Phase 7 requirement §7 API) — admin+. Runs
 * the same `runConsolidationForOrg` the nightly cron
 * (`/api/v1/cron/memory-consolidation`) calls, scoped to the caller's org;
 * useful for demoing/testing without waiting for the schedule, and for an
 * admin who just resolved a batch of risks/completed a project and wants
 * the Memory Explorer to reflect it immediately rather than overnight.
 */
export const POST = apiRoute(
  async (_request, ctx) => {
    const result = await runConsolidationForOrg(ctx.orgId);
    return NextResponse.json(result);
  },
  { minRole: "admin" }
);
