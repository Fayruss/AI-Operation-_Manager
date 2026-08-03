import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { convertEmailToTaskSchema } from "@/lib/validation/email";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";

/**
 * SAD §5 `POST /emails/:id/convert-to-task` — "Manually promote email to
 * task", member+, "writes task_activity + audit_log". Unlike the
 * classifier's automatic path (TaskRepository.createFromAgent), this is a
 * human-initiated action — the task is attributed to the calling user, not
 * the AI agent, even though `source` is still `email` (it originated from
 * an email either way, per SAD §4's source/source_ref_id rationale).
 */
export const POST = apiRoute<{ id: string }>(async (request, ctx, { id }) => {
  const input = await parseJsonBody(request, convertEmailToTaskSchema);
  const email = await EmailMessageRepository.getById(ctx.orgId, id);

  const task = await TaskRepository.createFromEmailConversion(ctx.orgId, ctx.userId, {
    boardId: input.boardId,
    title: email.subject,
    description: email.bodySnippet ?? undefined,
    priority: input.priority,
    sourceRefId: email.id
  });

  return NextResponse.json(task, { status: 201 });
});
