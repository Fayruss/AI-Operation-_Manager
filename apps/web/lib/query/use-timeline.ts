"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { TimelineEventDto } from "@/lib/api/dto";
import type { TimelineEntityType } from "@/lib/timeline/action-timeline-service";

/** Client-side Action Timeline fetch — used by the AI Copilot's timeline quick-prompt and any client-rendered detail view; server-rendered pages call `getActionTimeline` directly instead. */
export function useActionTimeline(entityType: TimelineEntityType, entityId: string | null) {
  return useQuery({
    queryKey: queryKeys.timeline.forEntity(entityType, entityId ?? ""),
    queryFn: () => apiClient.get<TimelineEventDto[]>(`/timeline?entityType=${entityType}&entityId=${entityId}`),
    enabled: Boolean(entityId)
  });
}
