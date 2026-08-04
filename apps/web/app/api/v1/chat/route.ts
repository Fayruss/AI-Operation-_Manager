import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { sendChatMessageSchema } from "@/lib/validation/chat";
import { sendChatMessage } from "@/lib/chat/chat-service";

/**
 * SAD §13.1 AI Chat Workspace — `POST /api/v1/chat`. Not one of the four
 * canonical patterns in the API Contract doc verbatim, but closest to
 * Pattern A (synchronous, returns the created resource): unlike Pattern
 * B's async job, a single Claude call comfortably fits inside a Vercel
 * function's timeout (SAD §9's agents are already synchronous request/
 * response), so there's no poll step here — the assistant's message comes
 * back in the same response.
 *
 * member+ (same tier as every other read-heavy/self-service endpoint;
 * chat itself never mutates operational data — only a subsequent
 * `/agents/chat/approve` call on a proposed action does, and that route
 * enforces its own role check).
 */
export const POST = apiRoute(
  async (request, ctx) => {
    const input = await parseJsonBody(request, sendChatMessageSchema);
    const result = await sendChatMessage(ctx.orgId, ctx.userId, input);
    return NextResponse.json(
      {
        session: result.session,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage
      },
      { status: 201 }
    );
  },
  { minRole: "member" }
);
