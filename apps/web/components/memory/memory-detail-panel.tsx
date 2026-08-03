"use client";

import { Brain, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EmbeddingStatusBadge, ImportanceBadge } from "@/components/memory/memory-entry-card";
import { useMemoryEntry, useRelatedMemoryEntries, useDeleteMemoryEntry } from "@/lib/query/use-memory";

/**
 * Memory Explorer detail panel (Phase 7 requirement §6: "Source tracing,
 * Related memories"). `sourceRefId` is the record that generated this
 * memory (e.g. a specific resolved risk_signal or email) — shown as a
 * traceable reference, matching the Action Timeline's "human+AI story"
 * reasoning (SAD §13.9) even though this predates that Phase 9 surface.
 */
export function MemoryDetailPanel({ entryId, onDeleted }: { entryId: string | null; onDeleted: () => void }) {
  const { data: entry, isLoading } = useMemoryEntry(entryId);
  const { data: related } = useRelatedMemoryEntries(entryId);
  const deleteEntry = useDeleteMemoryEntry();

  if (!entryId) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState icon={Brain} title="Select a memory" description="Choose an entry from the list to see its full content, source, and related memories." />
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !entry) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{entry.entityType}</Badge>
              <Badge variant="outline">{entry.sourceType}</Badge>
              <ImportanceBadge importance={entry.importance} />
              <EmbeddingStatusBadge status={entry.embeddingStatus} />
            </div>
            <CardTitle className="text-base">Memory entry</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete this memory entry"
            onClick={() => {
              if (confirm("Delete this memory entry? This can't be undone.")) {
                deleteEntry.mutate(entry.id, { onSuccess: onDeleted });
              }
            }}
            disabled={deleteEntry.isPending}
          >
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.content}</p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-xs">
            <dt className="text-muted-foreground">Source reference</dt>
            <dd className="font-mono">{entry.sourceRefId ?? "—"}</dd>
            <dt className="text-muted-foreground">Entity</dt>
            <dd className="font-mono">{entry.entityId ?? "—"}</dd>
            <dt className="text-muted-foreground">Accessed</dt>
            <dd>
              {entry.accessCount} time{entry.accessCount === 1 ? "" : "s"}
              {entry.lastAccessedAt ? `, last ${new Date(entry.lastAccessedAt).toLocaleDateString()}` : ""}
            </dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(entry.createdAt).toLocaleString()}</dd>
            {entry.embeddingModel && (
              <>
                <dt className="text-muted-foreground">Embedding model</dt>
                <dd className="font-mono">
                  {entry.embeddingModel}
                  {entry.embeddingVersion ? ` (v${entry.embeddingVersion})` : ""}
                </dd>
              </>
            )}
          </dl>

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Metadata</p>
              <pre className="overflow-x-auto rounded-md bg-surface-raised p-3 text-xs">{JSON.stringify(entry.metadata, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Related memories</CardTitle>
        </CardHeader>
        <CardContent>
          {!related || related.length === 0 ? (
            <p className="text-xs text-muted-foreground">No other memories about this entity yet.</p>
          ) : (
            <ul className="space-y-3">
              {related.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="line-clamp-2">{r.content}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.sourceType} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
