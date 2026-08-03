"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { EmailMessageDto, Page, TaskDto } from "@/lib/api/dto";

export interface EmailFilters {
  status?: string;
  urgency?: string;
}

function toSearchParams(filters: EmailFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.urgency) params.set("urgency", filters.urgency);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useEmails(filters: EmailFilters = {}) {
  return useQuery({
    queryKey: queryKeys.emails.list(filters),
    queryFn: () => apiClient.get<Page<EmailMessageDto>>(`/emails${toSearchParams(filters)}`)
  });
}

export function useConvertEmailToTask(emailId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { boardId: string; priority: string }) =>
      apiClient.post<TaskDto>(`/emails/${emailId}/convert-to-task`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.emails.list({}) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    }
  });
}
