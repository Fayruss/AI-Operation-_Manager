"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { AuditLogEntryDto, Page } from "@/lib/api/dto";

export interface AuditLogFilters {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
}

function toSearchParams(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.resourceId) params.set("resourceId", filters.resourceId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Owner/admin only server-side (SAD §5) — the hook itself has no client-side role gate; callers should check role before rendering the trigger. */
export function useAuditLog(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: queryKeys.auditLog.list(filters),
    queryFn: () => apiClient.get<Page<AuditLogEntryDto>>(`/audit-log${toSearchParams(filters)}`)
  });
}
