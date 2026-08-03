"use client";

import { Brain, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { MemoryEntryDto, MemoryContextItemDto } from "@/lib/api/dto";

/**
 * Component Spec pattern (TaskCard/ConfidenceChip precedent) — this file is
 * the Memory Module's equivalent: importance + embedding-status conveyed
 * via icon + color + text together (Design System §10: "never color
 * alone"), reused across the browse list and semantic search results
 * (Phase 7 requirement §6).
 */

/** Design System §2.3/§6 ConfidenceChip tiering, reused here for `importance` (0–1, same scale) since both are "how much should a reader trust/attend to this" signals. */
function importanceTier(importance: number): { label: string; variant: "info" | "default" | "outline" } {
  if (importance >= 0.7) return { label: "High", variant: "info" };
  if (importance >= 0.4) return { label: "Medium", variant: "default" };
  return { label: "Low", variant: "outline" };
}

const EMBEDDING_STATUS_CONFIG = {
  embedded: { label: "Embedded", icon: CheckCircle2, variant: "success" as const },
  pending: { label: "Pending", icon: Clock, variant: "outline" as const },
  failed: { label: "Failed", icon: XCircle, variant: "danger" as const }
};

export function EmbeddingStatusBadge({ status }: { status: "embedded" | "pending" | "failed" }) {
  const config = EMBEDDING_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function ImportanceBadge({ importance }: { importance: number }) {
  const tier = importanceTier(importance);
  return (
    <Badge variant={tier.variant} aria-label={`Importance: ${tier.label}, ${(importance * 100).toFixed(0)} percent`}>
      <Brain className="h-3 w-3" />
      {tier.label} · {(importance * 100).toFixed(0)}%
    </Badge>
  );
}

/** Browse-mode list item — full `MemoryEntryDto` (has `embeddingStatus`). */
export function MemoryEntryCard({
  entry,
  selected,
  onSelect
}: {
  entry: MemoryEntryDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "cursor-pointer transition-colors duration-micro hover:border-primary/50",
        selected && "border-primary bg-primary/5"
      )}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{entry.entityType}</Badge>
          <Badge variant="outline">{entry.sourceType}</Badge>
          <ImportanceBadge importance={entry.importance} />
          <EmbeddingStatusBadge status={entry.embeddingStatus} />
        </div>
        <p className="line-clamp-2 text-sm text-foreground">{entry.content}</p>
        <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

/** Semantic-search-mode result item — the slimmer `MemoryContextItemDto` shape (no `embeddingStatus`, every result is by definition embedded). */
export function MemorySearchResultCard({
  item,
  selected,
  onSelect
}: {
  item: MemoryContextItemDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "cursor-pointer transition-colors duration-micro hover:border-primary/50",
        selected && "border-primary bg-primary/5"
      )}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{item.entityType}</Badge>
          <Badge variant="outline">{item.sourceType}</Badge>
          <ImportanceBadge importance={item.importance} />
          <Badge variant="info" aria-label={`Relevance: ${(item.similarity * 100).toFixed(0)} percent`}>
            {(item.similarity * 100).toFixed(0)}% match
          </Badge>
        </div>
        <p className="line-clamp-2 text-sm text-foreground">{item.content}</p>
      </CardContent>
    </Card>
  );
}
