import "server-only";
import { prisma } from "@ai-ops/database";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";
import { MeetingActionItemRepository } from "@/lib/repositories/meeting-action-item-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { runSummarizerAgent } from "@/lib/ai/agents/summarizer-agent";
import { findDefaultBoardId } from "@/lib/email/email-sync-service";
import type { IngestMeetingInput } from "@/lib/validation/meeting";

/**
 * SAD §2.3/§8.3 Meeting Processing pipeline — direct-invocation stand-in for
 * the n8n Meeting Processing Workflow (n8n Workflow Spec §3): insert
 * meeting → Summarizer Agent → parse action items → for each, create a
 * task (Task Creation Workflow §2's equivalent is
 * `TaskRepository.createFromAgent`) → link `meeting_action_items.linked_task_id`
 * → update `meetings.summary`. Failure at the summarizer step leaves
 * `meetings.summary` null (never a partial/corrupt write) — matching n8n
 * Workflow Spec §3's failure handling exactly: "meeting owner notified with
 * a manual re-run summarization action" is the UI-side equivalent of that
 * (Meeting Dashboard, not built as a separate notification in this phase).
 */

/**
 * Best-effort owner resolution: match the Summarizer's `suggested_owner`
 * (a free-text name from the transcript) against org members by name.
 * Case-insensitive substring match in either direction — good enough for a
 * foundation phase; anything more (fuzzy matching, email-based resolution)
 * is future polish, not a schema/architecture concern.
 */
async function resolveOwnerId(orgId: string, suggestedOwner: string | null): Promise<string | null> {
  if (!suggestedOwner) return null;
  const needle = suggestedOwner.trim().toLowerCase();
  if (!needle) return null;

  const members = await prisma.user.findMany({ where: { orgId }, select: { id: true, name: true } });
  const match = members.find(
    (m) => m.name.toLowerCase().includes(needle) || needle.includes(m.name.toLowerCase())
  );
  return match?.id ?? null;
}

export interface ProcessMeetingResult {
  meetingId: string;
  agentRunId: string;
  actionItemCount: number;
  tasksCreated: number;
}

export async function processMeetingTranscript(orgId: string, input: IngestMeetingInput): Promise<ProcessMeetingResult> {
  const meeting = await MeetingRepository.create(orgId, {
    title: input.title,
    transcript: input.transcript,
    occurredAt: new Date(input.occurredAt)
  });

  // Summarizer failure leaves meetings.summary null and rethrows — the
  // caller (ingest route) is responsible for surfacing that (n8n Workflow
  // Spec §3 failure handling: "never silently dropped").
  const { agentRunId, output } = await runSummarizerAgent({
    orgId,
    meetingId: meeting.id,
    title: meeting.title,
    transcript: meeting.transcript
  });

  const ownerResolutions = await Promise.all(
    output.action_items.map((item) => resolveOwnerId(orgId, item.suggested_owner))
  );

  const createdActionItems = await MeetingActionItemRepository.createMany(
    meeting.id,
    output.action_items.map((item, i) => ({ description: item.description, ownerId: ownerResolutions[i] ?? null }))
  );

  const boardId = await findDefaultBoardId(orgId);
  let tasksCreated = 0;

  if (boardId) {
    for (const actionItem of createdActionItems) {
      const task = await TaskRepository.createFromAgent(orgId, boardId, agentRunId, {
        title: actionItem.description.slice(0, 200),
        priority: "medium",
        source: "meeting",
        sourceRefId: meeting.id
      });
      await MeetingActionItemRepository.linkTask(actionItem.id, task.id);
      tasksCreated += 1;
    }
  }
  // No board yet — action items are still recorded and visible on the
  // Meeting Dashboard; task creation simply has nothing to attach to
  // (same "not an error condition" reasoning as the email pipeline).

  await MeetingRepository.updateSummary(meeting.id, output.summary);

  return { meetingId: meeting.id, agentRunId, actionItemCount: createdActionItems.length, tasksCreated };
}
