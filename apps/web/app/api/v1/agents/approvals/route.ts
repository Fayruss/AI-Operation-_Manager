import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";

/**
 * Implementation Guide Phase 10 Approval Center — the read side of the
 * existing API Contract Pattern D approval flow (`POST /agents/:name/approve`),
 * which could previously only be actioned inline from a chat bubble with no
 * central view of what was waiting.
 *
 * `minRole: "member"` matches the approve route's own role gate: a user who
 * may decide an approval must be able to see the queue of them. The list is
 * org-scoped through `ctx.orgId`, so tenant isolation holds exactly as it
 * does for every other list endpoint.
 */
export const GET = apiRoute(
  async (_request, ctx) => {
    const runs = await AgentRunRepository.listAwaitingApproval(ctx.orgId);
    return NextResponse.json({ items: runs });
  },
  { minRole: "member" }
);
