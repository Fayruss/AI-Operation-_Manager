"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { BoardDto } from "@/lib/api/dto";
import type { CreateBoardInput } from "@/lib/validation/board";

export function useBoards(projectId: string) {
  return useQuery({
    queryKey: queryKeys.boards.byProject(projectId),
    queryFn: () => apiClient.get<{ boards: BoardDto[] }>(`/boards?projectId=${projectId}`),
    enabled: Boolean(projectId)
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBoardInput) => apiClient.post<BoardDto>("/boards", input),
    onSuccess: (board) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.byProject(board.projectId) });
    }
  });
}
