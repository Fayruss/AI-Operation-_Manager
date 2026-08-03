import "server-only";
import { prisma, type MeetingActionItem } from "@ai-ops/database";

export const MeetingActionItemRepository = {
  async createMany(
    meetingId: string,
    items: { description: string; ownerId: string | null }[]
  ): Promise<MeetingActionItem[]> {
    if (items.length === 0) return [];
    await prisma.meetingActionItem.createMany({
      data: items.map((item) => ({ meetingId, description: item.description, ownerId: item.ownerId }))
    });
    return prisma.meetingActionItem.findMany({ where: { meetingId }, orderBy: { id: "asc" } });
  },

  /** n8n Workflow Spec §3: "Postgres update meeting_action_items.linked_task_id" per created task. */
  async linkTask(actionItemId: string, taskId: string): Promise<void> {
    await prisma.meetingActionItem.update({ where: { id: actionItemId }, data: { linkedTaskId: taskId } });
  },

  /** SAD §7.5 KPI: "Action-item conversion rate (meetings → tasks created)." */
  async getConversionStats(meetingIds: string[]): Promise<{ total: number; linked: number }> {
    if (meetingIds.length === 0) return { total: 0, linked: 0 };
    const [total, linked] = await Promise.all([
      prisma.meetingActionItem.count({ where: { meetingId: { in: meetingIds } } }),
      prisma.meetingActionItem.count({ where: { meetingId: { in: meetingIds }, linkedTaskId: { not: null } } })
    ]);
    return { total, linked };
  }
};
