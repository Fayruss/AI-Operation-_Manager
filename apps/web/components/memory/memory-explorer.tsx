"use client";

import { useMemo, useState } from "react";
import { Brain, Loader2, Search, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MemoryEntryCard, MemorySearchResultCard } from "@/components/memory/memory-entry-card";
import { MemoryDetailPanel } from "@/components/memory/memory-detail-panel";
import { useMemoryEntries, useMemoryStats, useSearchMemory, type MemoryFilters } from "@/lib/query/use-memory";
import type { Page, MemoryEntryDto } from "@/lib/api/dto";

const SOURCE_TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "task", label: "Projects" },
  { value: "meeting", label: "Meetings" },
  { value: "email", label: "Emails" },
  { value: "risk_signal", label: "Risks" },
  { value: "report", label: "Reports" },
  { value: "manual", label: "Manual" }
] as const;

/**
 * Memory Explorer (SAD §13.6, Phase 7 requirement §6) — hydrated from the
 * Server Component's initial fetch (no loading flash, same pattern as
 * ReportsList/RiskSignalFeed), then live via TanStack Query. Two modes:
 *   - **Browse**: paginated (`useInfiniteQuery` + Load more), filterable by
 *     source type and a free-text `content` substring match.
 *   - **Semantic search**: natural-language query through the same
 *     `retrieveMemoryContext` path every agent uses (Phase 7 requirement
 *     §4/§5) — lets a person verify what an agent would actually retrieve
 *     for a given prompt, which is also a transparency/trust feature in
 *     its own right (SAD §13.6's stated purpose).
 */
export function MemoryExplorer({ initialData }: { initialData: Page<MemoryEntryDto> }) {
  const [sourceType, setSourceType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "semantic">("browse");
  const [semanticQuery, setSemanticQuery] = useState("");

  const filters: MemoryFilters = useMemo(
    () => ({ sourceType: sourceType === "all" ? undefined : sourceType, q: q.trim() || undefined }),
    [sourceType, q]
  );

  const browseQuery = useMemoryEntries(filters, sourceType === "all" && !q ? initialData : undefined);
  const search = useSearchMemory();
  const stats = useMemoryStats();

  const browseEntries = browseQuery.data?.pages.flatMap((page) => page.items) ?? [];

  function handleSemanticSearch() {
    if (!semanticQuery.trim()) return;
    setSelectedId(null);
    search.mutate({
      query: semanticQuery,
      sourceType: sourceType === "all" ? undefined : sourceType,
      topK: 20
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-4">
        {stats.data && stats.data.total > 0 && (
          <p className="text-xs text-muted-foreground">
            {stats.data.total} memories · {stats.data.embedded} embedded
            {stats.data.pending > 0 ? ` · ${stats.data.pending} pending` : ""}
            {stats.data.failed > 0 ? ` · ${stats.data.failed} failed` : ""}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant={mode === "browse" ? "default" : "secondary"}
            size="sm"
            onClick={() => setMode("browse")}
          >
            <Search className="h-3.5 w-3.5" />
            Browse
          </Button>
          <Button
            variant={mode === "semantic" ? "default" : "secondary"}
            size="sm"
            onClick={() => setMode("semantic")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Semantic search
          </Button>
        </div>

        {mode === "browse" ? (
          <Input
            placeholder="Search memory content…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search memory content"
          />
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Ask a question, e.g. “what's happened with the Acme project?”"
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
              aria-label="Semantic memory search query"
            />
            <Button onClick={handleSemanticSearch} disabled={search.isPending || !semanticQuery.trim()}>
              {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Search
            </Button>
          </div>
        )}

        <Tabs value={sourceType} onValueChange={setSourceType}>
          <TabsList className="flex-wrap">
            {SOURCE_TYPE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {mode === "browse" ? (
            <>
              {browseQuery.isLoading && (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              )}
              {!browseQuery.isLoading && browseEntries.length === 0 && (
                <EmptyState
                  icon={Brain}
                  title="No memories yet"
                  description="Organizational memory builds up automatically as risks resolve, projects complete, meetings are summarized, and important emails arrive — or add one manually."
                />
              )}
              {browseEntries.map((entry) => (
                <MemoryEntryCard key={entry.id} entry={entry} selected={entry.id === selectedId} onSelect={() => setSelectedId(entry.id)} />
              ))}
              {browseQuery.hasNextPage && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => browseQuery.fetchNextPage()}
                  disabled={browseQuery.isFetchingNextPage}
                >
                  {browseQuery.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Load more
                </Button>
              )}
            </>
          ) : (
            <>
              {search.isPending && (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              )}
              {!search.isPending && search.data?.degraded && (
                <Card>
                  <CardContent className="p-4 text-xs text-muted-foreground">
                    Semantic search is temporarily unavailable — try again shortly, or use Browse mode.
                  </CardContent>
                </Card>
              )}
              {!search.isPending && search.data && !search.data.degraded && search.data.items.length === 0 && (
                <EmptyState icon={Search} title="No matches" description="Nothing in organizational memory is closely related to that query yet." />
              )}
              {search.data?.items.map((item) => (
                <MemorySearchResultCard key={item.id} item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} />
              ))}
              {!search.isPending && !search.data && (
                <p className="px-1 text-xs text-muted-foreground">
                  Enter a question above to search using the same semantic retrieval every AI agent uses.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <MemoryDetailPanel entryId={selectedId} onDeleted={() => setSelectedId(null)} />
      </div>
    </div>
  );
}
