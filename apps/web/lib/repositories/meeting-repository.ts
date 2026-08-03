import "server-only";
import { prisma, type Meeting } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";

export const MeetingRepository = {
  async list(orgId: string, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.meeting.findMany({
      where: { orgId, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  async getByIdWithActionItems(orgId: string, id: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id, orgId },
      include: {
        actionItems: {
          include: {
            task: { select: { id: true, title: true, status: true } },
            owner: { select: { id: true, name: true } }
          }
        }
      }
    });
    if (!meeting) {
      throw new ApiError("NOT_FOUND", "Meeting not found", undefined, "MEETING_NOT_FOUND");
    }
    return meeting;
  },

  /** n8n Workflow Spec §3 node 2: "Postgres insert meetings (raw transcript)." */
  async create(orgId: string, input: { title: string; transcript: string; occurredAt: Date }): Promise<Meeting> {
    return prisma.meeting.create({
      data: { orgId, title: input.title, transcript: input.transcript, occurredAt: input.occurredAt }
    });
  },

  /** n8n Workflow Spec §3: "Postgres update meetings.summary." */
  async updateSummary(id: string, summary: string): Promise<Meeting> {
    return prisma.meeting.update({ where: { id }, data: { summary } });
  },

  /** SAD §2.5 Reporting Module — meetings processed within a report period. */
  async countInPeriod(orgId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    return prisma.meeting.count({ where: { orgId, occurredAt: { gte: periodStart, lte: periodEnd } } });
  }
};
