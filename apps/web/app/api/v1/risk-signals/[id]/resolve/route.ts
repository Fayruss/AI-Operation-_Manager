import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { resolveRiskSignalSchema } from "@/lib/validation/risk";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";

/** SAD §5 `POST /risk-signals/:id/resolve` — admin+. */
export const POST = apiRoute<{ id: string }>(
  async (request, ctx, { id }) => {
    const input = await parseJsonBody(request, resolveRiskSignalSchema);
    const resolved = await RiskSignalRepository.resolve(ctx.orgId, ctx.userId, id, input.note);
    return NextResponse.json(resolved);
  },
  { minRole: "admin" }
);
