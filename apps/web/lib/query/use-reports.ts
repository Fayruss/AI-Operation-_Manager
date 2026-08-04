"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Page, ReportDto } from "@/lib/api/dto";
import type { GenerateReportInput } from "@/lib/validation/report";

/**
 * Overloaded so a caller that supplies `initialData` (the Server Component
 * hand-off, e.g. ReportsList) gets a non-optional `data` — TanStack only
 * narrows `data` when `initialData` is statically known to be defined.
 */
export function useReports(
  initialData: Page<ReportDto>
): UseQueryResult<Page<ReportDto>, Error> & { data: Page<ReportDto> };
export function useReports(initialData?: Page<ReportDto>): UseQueryResult<Page<ReportDto>, Error>;
export function useReports(initialData?: Page<ReportDto>) {
  return useQuery({
    queryKey: queryKeys.reports.all,
    queryFn: () => apiClient.get<Page<ReportDto>>("/reports"),
    initialData
  });
}

/** API Contract Pattern B: "Intermediate poll (status: 'generating') returns 200... client polls every 3s." */
export function useReport(id: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.detail(id ?? ""),
    queryFn: () => apiClient.get<ReportDto>(`/reports/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === "generating" ? 3000 : false)
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateReportInput) => apiClient.post<{ reportId: string; status: string; pollUrl: string }>("/reports/generate", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    }
  });
}
