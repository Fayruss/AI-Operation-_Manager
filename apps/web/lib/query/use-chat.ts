"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Page, ChatSessionDto, ChatMessageDto } from "@/lib/api/dto";
import type { SendChatMessageInput } from "@/lib/validation/chat";

/** Chat Workspace history sidebar (SAD §13.1). */
export function useChatSessions() {
  return useQuery({
    queryKey: queryKeys.chat.sessions(),
    queryFn: () => apiClient.get<Page<ChatSessionDto>>("/chat/sessions")
  });
}

/** Full transcript for a session — disabled until a session is actually selected/created. */
export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.chat.messages(sessionId ?? ""),
    queryFn: () => apiClient.get<ChatMessageDto[]>(`/chat/sessions/${sessionId}/messages`),
    enabled: Boolean(sessionId)
  });
}

export interface SendChatMessageResponse {
  session: ChatSessionDto;
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}

/**
 * ChatPanel's `onSend(message)` (Component Spec). Synchronous request/
 * response (SAD §13.1's Claude call, same pattern as every other agent) —
 * `streaming` state in the UI covers the request's in-flight period rather
 * than true token-by-token streaming, since this codebase's Claude client
 * (claude-client.ts) is JSON-structured-output-only, matching every other
 * agent's call shape.
 */
export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendChatMessageInput) => apiClient.post<SendChatMessageResponse>("/chat", input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() });
      queryClient.setQueryData<ChatMessageDto[]>(queryKeys.chat.messages(data.session.id), (existing) => [
        ...(existing ?? []),
        data.userMessage,
        data.assistantMessage
      ]);
    }
  });
}

/** ChatPanel's `onApproveAction`/`onRejectAction` (Component Spec) — reuses the existing Pattern D endpoint, agent name "chat". */
export function useApproveChatAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { agentRunId: string; decision: "approved" | "rejected" }) =>
      apiClient.post<{ agentRunId: string; status: string; executedAt: string }>("/agents/chat/approve", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions() });
    }
  });
}
