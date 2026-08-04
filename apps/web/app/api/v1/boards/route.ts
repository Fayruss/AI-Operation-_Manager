import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { ApiError } from "@/lib/api/errors";
import { createBoardSchema } from "@/lib/validation/board";
import { BoardRepository } from "@/lib/repositories/board-repository";

const listBoardsQuerySchema = z.object({ projectId: z.string().uuid() });

export const GET = apiRoute(async (request, ctx) => {
  const result = listBoardsQuerySchema.safeParse({ projectId: request.nextUrl.searchParams.get("projectId") });
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "projectId query parameter is required", {
      issues: result.error.issues
    });
  }
  const boards = await BoardRepository.listByProject(ctx.orgId, result.data.projectId);
  return NextResponse.json({ boards });
});

/** `minRole: "member"` per the API Contract's documented member+ requirement for creates — viewers are read-only. */
export const POST = apiRoute(
  async (request, ctx) => {
    const input = await parseJsonBody(request, createBoardSchema);
    const board = await BoardRepository.create(ctx.orgId, ctx.userId, input);
    return NextResponse.json(board, { status: 201 });
  },
  { minRole: "member" }
);
