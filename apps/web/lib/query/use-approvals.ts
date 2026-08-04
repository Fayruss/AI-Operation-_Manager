"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { AgentRunDto } from "@/lib/api/dto";

export interface ApprovalDecisionInput {
  agentRunId: string;
  agentName: string;
  decision: "approved" | "rejected";
  note?: string;
}

/**
 * Implementation Guide Phase 10 Approval Center — every agent run parked at
 * `awaiting_approval` (SAD §8.7/§9.5's approval gate, CLAUDE.md's "every
 * irreversible AI action requires human approval").
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: queryKeys.approvals.all,
    queryFn: () => apiClient.get<{ items: AgentRunDto[] }>("/agents/approvals")
  });
}

/**
 * Reuses the existing API Contract Pattern D endpoint
 * (`POST /agents/:name/approve`) — the agent name is part of the path, so a
 * classifier suggestion and a chat proposal route to their own documented
 * execute-on-approval branches.
 *
 * Optimistically removes the decided run from the pending list: the queue
 * is a worklist, and a row that lingers after a click reads as a failed
 * decision. `onError` restores the snapshot so a rejected request (e.g. the
 * `ALREADY_DECIDED` 400 from a double-approval) puts the row back rather
 * than silently dropping it.
 */
export function useDecideApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentRunId, agentName, decision, note }: ApprovalDecisionInput) =>
      apiClient.post<{ agentRunId: string; status: string; executedAt: string }>(`/agents/${agentName}/approve`, {
        agentRunId,
        decision,
        note
      }),

    onMutate: async ({ agentRunId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.approvals.all });
      const previous = queryClient.getQueryData<{ items: AgentRunDto[] }>(queryKeys.approvals.all);
      queryClient.setQueryData<{ items: AgentRunDto[] }>(queryKeys.approvals.all, (current) =>
        current ? { items: current.items.filter((run) => run.id !== agentRunId) } : current
      );
      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.approvals.all, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      // An approved classifier suggestion creates a task; an approved chat
      // proposal creates a notification. Both surfaces need to refetch.
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}
