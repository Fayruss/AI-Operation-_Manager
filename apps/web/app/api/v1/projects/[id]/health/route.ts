import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { ProjectRepository } from "@/lib/repositories/project-repository";

/** SAD §5 `GET /projects/:id/health` — member+. */
export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const health = await ProjectRepository.getHealth(ctx.orgId, id);
  return NextResponse.json(health);
});
