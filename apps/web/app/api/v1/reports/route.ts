import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { listReportsQuerySchema } from "@/lib/validation/report";
import { ReportRepository } from "@/lib/repositories/report-repository";

/** SAD §7.6 Reports Dashboard — "Report history table." admin+ per API Contract's reports endpoints. */
export const GET = apiRoute(
  async (request, ctx) => {
    const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
    const filters = listReportsQuerySchema.parse({ type: request.nextUrl.searchParams.get("type") ?? undefined });
    const page = await ReportRepository.list(ctx.orgId, filters, cursor, limit);
    return NextResponse.json(page);
  },
  { minRole: "admin" }
);
