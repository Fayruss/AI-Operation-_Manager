import { Bot, User as UserIcon, Settings2 } from "lucide-react";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils/cn";
import type { TimelineEventDto } from "@/lib/api/dto";

const ACTOR_ICON = { user: UserIcon, ai_agent: Bot, system: Settings2 } as const;

const ACTION_LABEL: Record<string, string> = {
  created: "created this",
  updated: "updated this",
  "agent_run.success": "completed successfully",
  "agent_run.failed": "failed",
  "agent_run.awaiting_approval": "is awaiting approval",
  "task.created": "created the task",
  "agent_run.approved": "approved the AI's proposed action",
  "agent_run.rejected": "rejected the AI's proposed action"
};

function describeAction(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, " ");
}

/**
 * Component Spec pattern (ActionTimeline entry, per §6 "reused across
 * Email/Meeting/Task detail views"): "connector line + icon nodes."
 * Presentational only (CLAUDE.md: "no business logic in components") —
 * both Server Component pages (passing events from
 * `getActionTimeline` directly) and client hooks (`useActionTimeline`)
 * render through this same component.
 */
export function ActionTimeline({ events }: { events: TimelineEventDto[] }) {
  if (events.length === 0) {
    return <EmptyState icon={Settings2} title="No activity yet" description="Actions taken on this record will appear here." />;
  }

  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {events.map((event) => {
        const Icon = ACTOR_ICON[event.actorType];
        return (
          <li key={event.id} className="relative">
            <span
              className={cn(
                "absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-raised",
                event.actorType === "ai_agent" && "border-info text-info",
                event.action.endsWith("failed") && "border-danger text-danger"
              )}
              aria-hidden
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{event.actorLabel}</span>
              <span className="text-sm text-muted-foreground">{describeAction(event.action)}</span>
              <ConfidenceChip confidence={event.confidence} rationale={event.rationale} />
            </div>
            <time className="mt-0.5 block text-xs text-muted-foreground" dateTime={event.occurredAt}>
              {new Date(event.occurredAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })}
            </time>
            {event.detail && (
              <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-surface p-2 font-mono text-xs text-muted-foreground">
                {event.detail}
              </pre>
            )}
          </li>
        );
      })}
    </ol>
  );
}
