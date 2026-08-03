import "server-only";
import { ChatSessionRepository } from "@/lib/repositories/chat-session-repository";
import { ChatMessageRepository } from "@/lib/repositories/chat-message-repository";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { runChatAgent } from "@/lib/ai/agents/chat-agent";
import type { SendChatMessageInput } from "@/lib/validation/chat";
import type { ChatSession, ChatMessage } from "@ai-ops/database";

export interface SendChatMessageResult {
  session: ChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

/**
 * SAD §13.1's full turn: resolve/create the session, persist the user's
 * message, run the retrieval-orchestrating Chat Agent, and — if it
 * proposes an action — open a *second*, separate `agent_runs` row with
 * `status=awaiting_approval` for that proposal (distinct from the chat
 * turn's own `agent_runs` row, which already recorded success/failure via
 * chat-agent.ts). This mirrors every other agent's approval-gate pattern
 * (SAD §8.7/§9.5): the turn itself always completes, the *action* is what
 * waits on a human. `chat_messages.proposed_action_run_id` is the wire
 * between them (SAD §13.11).
 */
export async function sendChatMessage(orgId: string, userId: string, input: SendChatMessageInput): Promise<SendChatMessageResult> {
  const session = input.sessionId
    ? await ChatSessionRepository.getByIdForUser(orgId, userId, input.sessionId)
    : await ChatSessionRepository.create(orgId, userId, input.message);

  const userMessage = await ChatMessageRepository.create({
    sessionId: session.id,
    role: "user",
    content: input.message
  });

  const contextLabel = input.contextEntity ? `${input.contextEntity.type} ${input.contextEntity.id}` : null;
  const result = await runChatAgent(orgId, input.message, contextLabel);

  let proposedActionRunId: string | null = null;
  if (result.proposedAction) {
    const actionRun = await AgentRunRepository.start({
      orgId,
      agentName: "chat",
      triggerSource: "chat.proposed_action",
      input: { sessionId: session.id, chatAgentRunId: result.agentRunId }
    });
    await AgentRunRepository.markAwaitingApproval(actionRun.id, {
      output: {
        type: result.proposedAction.type,
        targetUserId: result.proposedAction.targetUserId,
        targetUserName: result.proposedAction.targetUserName,
        summary: result.proposedAction.summary
      }
    });
    proposedActionRunId = actionRun.id;
  }

  const assistantMessage = await ChatMessageRepository.create({
    sessionId: session.id,
    role: "assistant",
    content: result.answer,
    referencedEntities: result.referencedEntities,
    proposedActionRunId
  });

  await ChatSessionRepository.touch(session.id);

  return { session, userMessage, assistantMessage };
}

export async function getChatHistory(orgId: string, userId: string, sessionId: string): Promise<ChatMessage[]> {
  await ChatSessionRepository.getByIdForUser(orgId, userId, sessionId);
  return ChatMessageRepository.listForSession(sessionId);
}
