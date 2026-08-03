"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { RoiMetricsDto, OrgMapDto } from "@/lib/api/dto";

/** SAD §13.4 ROI/Time-Saved Metrics KPI row. */
export function useRoiMetrics(days = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.roi(String(days)),
    queryFn: () => apiClient.get<RoiMetricsDto>(`/analytics/roi?days=${days}`)
  });
}

/** SAD §13.7 Organization Map — client-fetched since the React Flow canvas is a Client Component (interactive pan/zoom). */
export function useOrgMap() {
  return useQuery({
    queryKey: queryKeys.analytics.orgMap(),
    queryFn: () => apiClient.get<OrgMapDto>("/analytics/org-map")
  });
}
