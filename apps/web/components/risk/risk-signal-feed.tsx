"use client";

import { AlertCircle, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { ResolveRiskButton } from "@/components/risk/resolve-risk-button";
import { useRiskSignals } from "@/lib/query/use-risk-signals";
import type { Page, RiskSignalDto } from "@/lib/api/dto";

const SEVERITY_VARIANT = { high: "danger", medium: "warning", low: "outline" } as const;
const SIGNAL_TYPE_LABEL = {
  stale_task: "Stale task",
  sla_breach: "SLA breach",
  velocity_drop: "Velocity drop",
  sentiment_negative: "Negative sentiment"
} as const;

/**
 * Client island for the Operations Dashboard risk feed — hydrates from the
 * Server Component's initial fetch (no loading flash), then uses
 * `useRiskSignals` for live updates: resolving a signal invalidates the
 * query so it actually disappears from the `resolved: false` list instead
 * of just flipping a local "Resolved" label in place.
 */
export function RiskSignalFeed({ initialData }: { initialData: Page<RiskSignalDto> }) {
  const { data } = useRiskSignals({ resolved: false });
  const signals = data?.items ?? initialData.items;

  if (signals.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="You're on track"
        description="No active risk signals. The scheduled scan checks for stale tasks, SLA breaches, and velocity drops every 15 minutes."
      />
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => {
        const detail = signal.detail;
        const rationale = typeof detail.rationale === "string" ? detail.rationale : null;
        return (
          <div key={signal.id} className="flex items-start justify-between gap-4 rounded-md border border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={SEVERITY_VARIANT[signal.severity]}>{signal.severity}</Badge>
                <span className="text-xs font-medium text-muted-foreground">{SIGNAL_TYPE_LABEL[signal.signalType]}</span>
              </div>
              <p className="mt-1 text-sm">
                {rationale ?? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {signal.entityType === "task" ? "Task" : "Project"} {signal.entityId} flagged.
                  </span>
                )}
              </p>
            </div>
            <div className="shrink-0">
              <ResolveRiskButton signalId={signal.id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
