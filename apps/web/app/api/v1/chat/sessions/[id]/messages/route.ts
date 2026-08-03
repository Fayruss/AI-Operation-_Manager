import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { getChatHistory } from "@/lib/chat/chat-service";

/** SAD §13.1 Chat Workspace — full transcript for one session (opening/resuming a thread from history). */
export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const messages = await getChatHistory(ctx.orgId, ctx.userId, id);
  return NextResponse.json(messages);
});
