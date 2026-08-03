import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { ChatSessionRepository } from "@/lib/repositories/chat-session-repository";

/** SAD §13.1 Chat Workspace — session history for the current user, cursor-paginated per API Contract Global Conventions. */
export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const page = await ChatSessionRepository.listForUser(ctx.orgId, ctx.userId, cursor, limit);
  return NextResponse.json(page);
});
