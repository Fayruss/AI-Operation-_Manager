import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { updateProjectSchema } from "@/lib/validation/project";
import { ProjectRepository } from "@/lib/repositories/project-repository";

export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const project = await ProjectRepository.getById(ctx.orgId, id);
  return NextResponse.json(project);
});

export const PATCH = apiRoute<{ id: string }>(async (request, ctx, { id }) => {
  const input = await parseJsonBody(request, updateProjectSchema);
  const updated = await ProjectRepository.update(ctx.orgId, ctx.userId, id, input);
  return NextResponse.json(updated);
});
