import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody, getIdempotencyKey } from "@/lib/api/request";
import { parsePaginationParams } from "@/lib/api/pagination";
import { createTaskSchema, listTasksQuerySchema } from "@/lib/validation/task";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { getIdempotentResponse, saveIdempotentResponse } from "@/lib/api/idempotency";

/** API Contract Pattern A — `GET /tasks` (paginated, filterable). */
export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const filters = listTasksQuerySchema.parse({
    boardId: request.nextUrl.searchParams.get("boardId") ?? undefined,
    assigneeId: request.nextUrl.searchParams.get("assigneeId") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined
  });
  const page = await TaskRepository.list(ctx.orgId, filters, cursor, limit);
  return NextResponse.json(page);
});

/**
 * API Contract Pattern A — `POST /tasks`. Reproduces the documented
 * request/response/validation contract exactly, including
 * `Idempotency-Key` support from the Global Conventions section.
 * `minRole: "member"` per the API Contract's documented `403 FORBIDDEN`
 * ("valid token, insufficient role — member+ required") — viewers are
 * read-only.
 */
export const POST = apiRoute(
  async (request, ctx) => {
    const idempotencyKey = getIdempotencyKey(request);
    const cached = getIdempotentResponse(ctx.orgId, idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }

    const input = await parseJsonBody(request, createTaskSchema);
    const task = await TaskRepository.create(ctx.orgId, ctx.userId, input);

    saveIdempotentResponse(ctx.orgId, idempotencyKey, 201, task);
    return NextResponse.json(task, { status: 201 });
  },
  { minRole: "member" }
);
