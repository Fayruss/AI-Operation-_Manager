import "server-only";
import { prisma, type ChatMessage, type ChatMessageRole, type Prisma } from "@ai-ops/database";
import type { ResolvedEntityReference } from "@/lib/ai/agents/chat-agent";

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface CreateChatMessageInput {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  referencedEntities?: ResolvedEntityReference[];
  proposedActionRunId?: string | null;
}

export const ChatMessageRepository = {
  /** Full transcript for a session, oldest first — matches ChatPanel's rendering order (Component Spec). */
  async listForSession(sessionId: string): Promise<ChatMessage[]> {
    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" }
    });
  },

  async create(input: CreateChatMessageInput): Promise<ChatMessage> {
    return prisma.chatMessage.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        referencedEntities: input.referencedEntities ? toJsonInput(input.referencedEntities) : undefined,
        proposedActionRunId: input.proposedActionRunId ?? undefined
      }
    });
  }
};
