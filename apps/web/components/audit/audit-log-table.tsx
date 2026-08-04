"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronDown, Loader2, Search, Settings2, Shield, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLog } from "@/lib/query/use-audit-log";
import type { AuditLogEntryDto } from "@/lib/api/dto";
import { cn } from "@/lib/utils/cn";

const ACTOR_ICON = { user: UserIcon, ai_agent: Bot, system: Settings2 } as const;

const ACTOR_LABEL = { user: "User", ai_agent: "AI agent", system: "System" } as const;

/**
 * Resource types worth offering as a filter. Derived from the
 * `resourceType` values the repositories actually write through
 * `writeAuditLog` — kept as a constant rather than a free-text box so the
 * filter can't produce an empty result set from a typo.
 */
const RESOURCE_TYPES = ["task", "project", "board", "agent_run", "report", "memory_entry", "user", "organization"] as const;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

/** `agent_run.approved` → "agent run approved" — readable without losing the underlying action key. */
function describeAction(action: string): string {
  return action.replace(/[._]/g, " ");
}

function actorName(entry: AuditLogEntryDto): string {
  if (entry.actor) return entry.actor.name;
  return ACTOR_LABEL[entry.actorType];
}

/**
 * Implementation Guide Phase 10 — Audit Log UI over the existing
 * `GET /audit-log` endpoint (SAD §5, owner/admin only, "filterable by
 * actor/resource"). Read-only by design: `audit_log` is append-only and
 * compliance-grade (SAD §2.8), so this surface never mutates.
 *
 * Search is deliberately client-side over the loaded pages: the documented
 * endpoint filters by actor/resource only, and adding a free-text `q`
 * parameter would change an API contract this phase is not permitted to
 * alter.
 */
export function AuditLogTable() {
  const [resourceType, setResourceType] = useState<string>("");
  const [search, setSearch] = useState("");

  const filters = useMemo(() => (resourceType ? { resourceType } : {}), [resourceType]);
  const query = useAuditLog(filters);

  const entries = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) =>
      [entry.action, entry.resourceType, entry.resourceId, actorName(entry), entry.actor?.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [entries, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="audit-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="audit-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by action, actor, or resource id…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5 sm:w-56">
          <Label htmlFor="audit-resource-type">Resource type</Label>
          <select
            id="audit-resource-type"
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
            className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All resource types</option>
            {RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading audit log…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {query.error.message}
        </p>
      ) : visibleEntries.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={entries.length === 0 ? "No audit events yet" : "No events match your filters"}
          description={
            entries.length === 0
              ? "Every human and AI mutation is recorded here as soon as it happens."
              : "Try a different search term or resource type."
          }
        />
      ) : (
        <>
          {/*
            A real <table> rather than a div grid: audit review is a
            row/column comparison task, and semantic table markup is what
            lets screen readers announce "column: actor" while navigating
            cells (CLAUDE.md accessibility: "screen-reader support").
          */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Audit log: every recorded action, newest first. {visibleEntries.length} events shown.
              </caption>
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    Timestamp
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    Actor
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    Resource
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <AuditLogRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>

          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One row, with the metadata JSON behind a native <details> disclosure —
 * keyboard-operable and screen-reader-announced without any custom ARIA or
 * focus management.
 */
function AuditLogRow({ entry }: { entry: AuditLogEntryDto }) {
  const Icon = ACTOR_ICON[entry.actorType];
  const hasMetadata = entry.metadata != null && Object.keys(entry.metadata).length > 0;

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
        <time dateTime={entry.createdAt}>{formatTimestamp(entry.createdAt)}</time>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border",
              entry.actorType === "ai_agent" && "border-info text-info"
            )}
            aria-hidden
          >
            <Icon className="h-3 w-3" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{actorName(entry)}</span>
            {entry.actor && <span className="block truncate text-xs text-muted-foreground">{entry.actor.email}</span>}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={entry.actorType === "ai_agent" ? "info" : "outline"}>{describeAction(entry.action)}</Badge>
      </td>
      <td className="px-4 py-3">
        <span className="block capitalize">{entry.resourceType.replace(/_/g, " ")}</span>
        <span className="block font-mono text-xs text-muted-foreground">{entry.resourceId}</span>
      </td>
      <td className="px-4 py-3">
        {hasMetadata ? (
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1 rounded text-xs text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden />
              View metadata
            </summary>
            <pre className="mt-2 max-w-xs overflow-x-auto rounded-md bg-surface p-2 font-mono text-xs text-muted-foreground">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
