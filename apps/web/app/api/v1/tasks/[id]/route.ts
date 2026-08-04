import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { updateTaskSchema } from "@/lib/validation/task";
import { TaskRepository } from "@/lib/repositories/task-repository";

export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const task = await TaskRepository.getById(ctx.orgId, id);
  return NextResponse.json(task);
});

/**
 * API Contract Pattern A — `PATCH /tasks/:id`, optimistic concurrency via
 * `updated_at`. `minRole: "member"` per the API Contract's documented
 * member+ requirement for mutations — viewers are read-only.
 */
export const PATCH = apiRoute<{ id: string }>(
  async (request, ctx, { id }) => {
    const input = await parseJsonBody(request, updateTaskSchema);
    const updated = await TaskRepository.update(ctx.orgId, ctx.userId, id, input);
    return NextResponse.json(updated);
  },
  { minRole: "member" }
);

/** API Contract: `DELETE /tasks/:id` — admin+, soft-delete only (never hard-deletes). */
export const DELETE = apiRoute<{ id: string }>(
  async (_request, ctx, { id }) => {
    await TaskRepository.softDelete(ctx.orgId, ctx.userId, id);
    return new NextResponse(null, { status: 204 });
  },
  { minRole: "admin" }
);
