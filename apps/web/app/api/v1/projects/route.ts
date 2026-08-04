import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody, getIdempotencyKey } from "@/lib/api/request";
import { parsePaginationParams } from "@/lib/api/pagination";
import { createProjectSchema } from "@/lib/validation/project";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/api/idempotency";

export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const page = await ProjectRepository.list(ctx.orgId, cursor, limit);
  return NextResponse.json(page);
});

/**
 * API Contract Pattern A shape (title/priority/etc. rules), applied here to
 * Project instead of Task. `minRole: "member"` per the API Contract's
 * documented member+ requirement for creates — viewers are read-only.
 */
export const POST = apiRoute(
  async (request, ctx) => {
    const idempotencyKey = getIdempotencyKey(request);
    const cached = getIdempotentResponse(ctx.orgId, idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }

    const input = await parseJsonBody(request, createProjectSchema);
    const project = await ProjectRepository.create(ctx.orgId, ctx.userId, input);

    saveIdempotentResponse(ctx.orgId, idempotencyKey, 201, project);
    return NextResponse.json(project, { status: 201 });
  },
  { minRole: "member" }
);
