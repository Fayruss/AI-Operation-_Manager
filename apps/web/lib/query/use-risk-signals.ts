"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Page, RiskSignalDto } from "@/lib/api/dto";

export interface RiskSignalFilters {
  resolved?: boolean;
  severity?: string;
}

function toSearchParams(filters: RiskSignalFilters): string {
  const params = new URLSearchParams();
  if (filters.resolved !== undefined) params.set("resolved", String(filters.resolved));
  if (filters.severity) params.set("severity", filters.severity);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useRiskSignals(filters: RiskSignalFilters = {}, initialData?: Page<RiskSignalDto>) {
  return useQuery({
    queryKey: queryKeys.riskSignals.list({ resolved: filters.resolved?.toString(), severity: filters.severity }),
    queryFn: () => apiClient.get<Page<RiskSignalDto>>(`/risk-signals${toSearchParams(filters)}`),
    initialData
  });
}

export function useResolveRiskSignal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient.post<RiskSignalDto>(`/risk-signals/${id}/resolve`, { note }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["risk-signals"] });
      const previous = queryClient.getQueriesData<Page<RiskSignalDto>>({ queryKey: ["risk-signals"] });

      // Optimistically drop the resolved signal from every cached
      // risk-signals list — the common case is viewing `resolved: false`,
      // where the item should simply disappear.
      queryClient.setQueriesData<Page<RiskSignalDto>>({ queryKey: ["risk-signals"] }, (page) => {
        if (!page) return page;
        return { ...page, items: page.items.filter((item) => item.id !== id) };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["risk-signals"] });
    }
  });
}
