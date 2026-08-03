import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { computeRoiMetrics } from "@/lib/analytics/roi-metrics-service";

/** SAD §13.4/§7.7 Analytics Dashboard ROI KPI row. `?days=` defaults to a 30-day trailing window. */
export const GET = apiRoute(async (request, ctx) => {
  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const periodDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;
  const metrics = await computeRoiMetrics(ctx.orgId, periodDays);
  return NextResponse.json(metrics);
});
