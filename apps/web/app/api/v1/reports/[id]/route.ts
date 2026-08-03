import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { ReportRepository } from "@/lib/repositories/report-repository";

/** API Contract Pattern B — `GET /reports/:id` poll endpoint. */
export const GET = apiRoute<{ id: string }>(
  async (_request, ctx, { id }) => {
    const report = await ReportRepository.getByIdInOrg(ctx.orgId, id);
    return NextResponse.json(report);
  },
  { minRole: "admin" }
);
