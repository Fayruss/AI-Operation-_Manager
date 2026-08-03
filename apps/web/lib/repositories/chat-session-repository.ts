import "server-only";
import { prisma, type ChatSession } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";

/** Sidebar/history label — first ~60 chars of the opening message, matching how most chat products title a thread. */
function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

export const ChatSessionRepository = {
  /** SAD §13.1: Chat Workspace history, scoped to the requesting user (not org-wide — chat sessions are personal, unlike task/board data). */
  async listForUser(orgId: string, userId: string, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.chatSession.findMany({
      where: { orgId, userId, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  async getByIdForUser(orgId: string, userId: string, id: string): Promise<ChatSession> {
    const session = await prisma.chatSession.findFirst({ where: { id, orgId, userId } });
    if (!session) {
      throw new ApiError("NOT_FOUND", "Chat session not found", undefined, "CHAT_SESSION_NOT_FOUND");
    }
    return session;
  },

  async create(orgId: string, userId: string, firstMessage: string): Promise<ChatSession> {
    return prisma.chatSession.create({
      data: { orgId, userId, title: deriveTitle(firstMessage) }
    });
  },

  /** Bumps `updatedAt` so the session sorts to the top of history after a new turn. */
  async touch(id: string): Promise<void> {
    await prisma.chatSession.update({ where: { id }, data: { updatedAt: new Date() } });
  }
};
