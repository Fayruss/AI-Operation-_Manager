import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { ApiError } from "@/lib/api/errors";
import { approveAgentRunSchema, classifierOutputSchema } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { NotificationRepository } from "@/lib/repositories/notification-repository";
import { findDefaultBoardId } from "@/lib/email/email-sync-service";
import { writeAuditLog } from "@/lib/api/audit";
import { z } from "zod";

/** Mirrors the shape chat-service.ts writes into `agent_runs.output` for a proposed `notify_user` action (SAD §13.1's "Yes" button). */
const chatNotifyActionOutputSchema = z.object({
  type: z.literal("notify_user"),
  targetUserId: z.string().uuid(),
  targetUserName: z.string(),
  summary: z.string()
});

/**
 * API Contract Pattern D `POST /agents/:name/approve`. `classifier`'s
 * suggested-task approval is member+ (lower stakes). `chat`'s proposed
 * action (SAD §13.1: notifying a person on the user's behalf) is likewise
 * member+ here — it's an in-app notification, not an irreversible/external
 * send (SAD §9.5's reply-draft, which would warrant admin+), and per the
 * API Contract's note that "role check documented per-agent since approval
 * authority varies."
 */
export const POST = apiRoute<{ name: string }>(async (request, ctx, { name }) => {
  if (name !== "classifier" && name !== "chat") {
    throw new ApiError("NOT_FOUND", `Unknown agent '${name}'`, undefined, "AGENT_NOT_FOUND");
  }

  const input = await parseJsonBody(request, approveAgentRunSchema);
  const agentRun = await AgentRunRepository.getByIdInOrg(ctx.orgId, input.agentRunId);

  const resolved = await AgentRunRepository.resolveApproval(ctx.orgId, input.agentRunId);

  if (input.decision === "approved") {
    if (name === "classifier") {
      const output = classifierOutputSchema.safeParse(agentRun.output);
      if (output.success && output.data.suggested_task) {
        const boardId = await findDefaultBoardId(ctx.orgId);
        if (boardId && agentRun.emailMessageId) {
          await TaskRepository.createFromAgent(ctx.orgId, boardId, agentRun.id, {
            title: output.data.suggested_task.title,
            priority: output.data.suggested_task.priority,
            source: "email",
            sourceRefId: agentRun.emailMessageId
          });
        }
      }
    } else if (name === "chat") {
      // SAD §13.1: "when the AI proposes an action... it does not execute
      // directly." This is the point where an approved proposal actually
      // becomes a real notification — same execute-on-approval boundary
      // classifier's suggested-task branch uses above.
      const output = chatNotifyActionOutputSchema.safeParse(agentRun.output);
      if (output.success) {
        await NotificationRepository.createMany(ctx.orgId, [
          {
            userId: output.data.targetUserId,
            type: "chat.action_approved",
            payload: { title: "Update from the AI Chat Workspace", description: output.data.summary }
          }
        ]);
      }
    }
  }

  await writeAuditLog({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: input.decision === "approved" ? "agent_run.approved" : "agent_run.rejected",
    resourceType: "agent_run",
    resourceId: resolved.id,
    metadata: { note: input.note, agentName: name }
  });

  return NextResponse.json({ agentRunId: resolved.id, status: input.decision, executedAt: new Date().toISOString() });
});
