"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { AuditLogEntryDto, Page } from "@/lib/api/dto";

export interface AuditLogFilters {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
}

function toSearchParams(filters: AuditLogFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.resourceId) params.set("resourceId", filters.resourceId);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Owner/admin only server-side (SAD §5) — the hook itself has no
 * client-side role gate; callers should check role before rendering the
 * trigger.
 *
 * Uses `useInfiniteQuery` for the API Contract's cursor pagination
 * (`?cursor=<opaque>&limit=50`), matching `useMemoryEntries` — the audit
 * log is append-only and unbounded, so "Load more" is the only correct
 * read pattern for it.
 */
export function useAuditLog(filters: AuditLogFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.auditLog.list(filters),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiClient.get<Page<AuditLogEntryDto>>(`/audit-log${toSearchParams(filters, pageParam)}`),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
}
