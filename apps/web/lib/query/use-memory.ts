"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { Page, MemoryEntryDto, MemoryContextItemDto } from "@/lib/api/dto";
import type { CreateMemoryEntryInput, SearchMemoryInput } from "@/lib/validation/memory";

export interface MemoryFilters {
  entityType?: string;
  entityId?: string;
  sourceType?: string;
  q?: string;
}

function toSearchParams(filters: MemoryFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.sourceType) params.set("sourceType", filters.sourceType);
  if (filters.q) params.set("q", filters.q);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Memory Explorer (Phase 7 requirement §6/§7) — list + filter by
 * type/project/person, with real cursor-based "Load more" pagination
 * (API Contract Global Conventions: `?cursor=<opaque>&limit=50`). Uses
 * `useInfiniteQuery` rather than the single-page `useQuery` pattern the
 * rest of this codebase's list hooks use (ReportsList/RiskSignalFeed don't
 * paginate past page one yet) — Memory Explorer is the first surface that
 * explicitly needs it.
 */
export function useMemoryEntries(filters: MemoryFilters = {}, initialData?: Page<MemoryEntryDto>) {
  return useInfiniteQuery({
    queryKey: queryKeys.memory.list(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiClient.get<Page<MemoryEntryDto>>(`/memory${toSearchParams(filters, pageParam)}`),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: initialData ? { pages: [initialData], pageParams: [null] } : undefined
  });
}

/** Embedding pipeline health overview (Memory Explorer header stat strip). */
export function useMemoryStats() {
  return useQuery({
    queryKey: queryKeys.memory.stats(),
    queryFn: () => apiClient.get<{ total: number; embedded: number; pending: number; failed: number }>("/memory/stats")
  });
}

export function useMemoryEntry(id: string | null) {
  return useQuery({
    queryKey: queryKeys.memory.detail(id ?? ""),
    queryFn: () => apiClient.get<MemoryEntryDto>(`/memory/${id}`),
    enabled: Boolean(id)
  });
}

/** Memory Explorer "related memories" (Phase 7 requirement §6). */
export function useRelatedMemoryEntries(id: string | null) {
  return useQuery({
    queryKey: queryKeys.memory.related(id ?? ""),
    queryFn: () => apiClient.get<MemoryEntryDto[]>(`/memory/${id}/related`),
    enabled: Boolean(id)
  });
}

/** Semantic search (Phase 7 requirement §4/§7) — the Memory Explorer search box, powered by the same retrieval path every agent uses. */
export function useSearchMemory() {
  return useMutation({
    mutationFn: (input: SearchMemoryInput) => apiClient.post<{ items: MemoryContextItemDto[]; degraded: boolean }>("/memory/search", input)
  });
}

export function useCreateMemoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemoryEntryInput) => apiClient.post<MemoryEntryDto>("/memory", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memory.all });
    }
  });
}

export function useDeleteMemoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ id: string; deleted: true }>(`/memory/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memory.all });
    }
  });
}

/** Admin+ (Phase 7 requirement §7 API) — model/version rebuild after an embedding provider change, or retrying specific failed entries. */
export function useRebuildEmbeddings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryIds?: string[]) =>
      apiClient.post<{ queued: number; embedded: number; failed: number }>("/memory/rebuild-embeddings", { entryIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memory.all });
    }
  });
}

/** Admin+ — manual trigger for the nightly consolidation cycle (SAD §8.6), useful for demoing/testing without waiting for the cron schedule. */
export function useRunConsolidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ candidatesFound: number; entriesCreated: number; entriesMerged: number; embedded: number }>(
        "/memory/consolidate",
        {}
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memory.all });
    }
  });
}
