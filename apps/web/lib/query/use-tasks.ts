"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Page, TaskDto } from "@/lib/api/dto";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task";

export interface TaskFilters {
  boardId?: string;
  assigneeId?: string;
  status?: string;
}

function toSearchParams(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.boardId) params.set("boardId", filters.boardId);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => apiClient.get<Page<TaskDto>>(`/tasks${toSearchParams(filters)}`)
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiClient.post<TaskDto>("/tasks", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}

/**
 * SAD §6.4: "optimistic updates for task drag-drop." The status field is
 * applied to the cache immediately; a failed request rolls back via
 * onError, and `updatedAt` (required for server-side optimistic
 * concurrency) always comes from the freshest cached copy of the task.
 */
export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => apiClient.patch<TaskDto>(`/tasks/${taskId}`, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previous = queryClient.getQueriesData<Page<TaskDto>>({ queryKey: queryKeys.tasks.all });

      queryClient.setQueriesData<Page<TaskDto>>({ queryKey: queryKeys.tasks.all }, (page) => {
        if (!page) return page;
        return {
          ...page,
          items: page.items.map((task): TaskDto =>
            task.id === taskId
              ? {
                  ...task,
                  title: input.title ?? task.title,
                  description: input.description === undefined ? task.description : input.description,
                  status: input.status ?? task.status,
                  priority: input.priority ?? task.priority,
                  assigneeId: input.assigneeId === undefined ? task.assigneeId : input.assigneeId,
                  dueDate: input.dueDate === undefined ? task.dueDate : input.dueDate
                }
              : task
          )
        };
      });

      return { previous };
    },
    onError: (_err, _input, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.delete<void>(`/tasks/${taskId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}
