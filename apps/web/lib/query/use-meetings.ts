"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { MeetingDetailDto, MeetingDto, Page } from "@/lib/api/dto";

export function useMeetings() {
  return useQuery({
    queryKey: queryKeys.meetings.all,
    queryFn: () => apiClient.get<Page<MeetingDto>>("/meetings")
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(id),
    queryFn: () => apiClient.get<MeetingDetailDto>(`/meetings/${id}`),
    enabled: Boolean(id)
  });
}
