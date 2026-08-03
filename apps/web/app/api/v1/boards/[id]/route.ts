import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { BoardRepository } from "@/lib/repositories/board-repository";

export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const board = await BoardRepository.getById(ctx.orgId, id);
  return NextResponse.json(board);
});
