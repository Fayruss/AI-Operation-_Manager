import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { listRiskSignalsQuerySchema } from "@/lib/validation/risk";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";

/** SAD §5 `GET /risk-signals` — member+, filterable, paginated. */
export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const filters = listRiskSignalsQuerySchema.parse({
    resolved: request.nextUrl.searchParams.get("resolved") ?? undefined,
    severity: request.nextUrl.searchParams.get("severity") ?? undefined
  });
  const page = await RiskSignalRepository.list(ctx.orgId, filters, cursor, limit);
  return NextResponse.json(page);
});
