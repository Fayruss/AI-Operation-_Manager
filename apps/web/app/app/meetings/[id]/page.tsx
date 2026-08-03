import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, CheckCircle2, History, ListChecks, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusBadgeKey } from "@/components/shared/status-badge";
import { ActionTimeline } from "@/components/shared/action-timeline";
import { CopilotButton } from "@/components/copilot/copilot-button";
import { getAuthContext } from "@/lib/auth/session";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";
import { getActionTimeline } from "@/lib/timeline/action-timeline-service";
import { ApiError } from "@/lib/api/errors";

const TASK_STATUS_TO_BADGE: Record<string, StatusBadgeKey> = {
  backlog: "pending",
  todo: "pending",
  in_progress: "pending",
  in_review: "pending",
  done: "done",
  blocked: "blocked"
};

/**
 * SAD §6.1 `/app/meetings/[id]` — meeting detail: summary, action items,
 * and linked tasks (SAD §4 design rationale: source/source_ref_id traces
 * every AI-created task back to its origin, surfaced here as the "linked
 * task" chip on each action item).
 */
export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) notFound();

  const meeting = await MeetingRepository.getByIdWithActionItems(ctx.orgId, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!meeting) notFound();

  const timelineEvents = await getActionTimeline(ctx.orgId, "meeting", id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={meeting.title}
        description={new Date(meeting.occurredAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        })}
        actions={
          <CopilotButton
            entityType="meeting"
            entityId={meeting.id}
            entityLabel={meeting.title}
            quickPrompts={["What are the open action items?", "Who owns the most action items here?", "Summarize the key decisions"]}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-info" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meeting.summary ? (
            <p className="text-sm leading-relaxed text-foreground">{meeting.summary}</p>
          ) : (
            <EmptyState
              icon={Calendar}
              title="Summarizing…"
              description="The Summarizer Agent is still processing this transcript. Refresh in a moment."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {meeting.actionItems.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No action items extracted"
              description="Either the meeting had none, or summarization hasn't completed yet."
            />
          ) : (
            <div className="space-y-2">
              {meeting.actionItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-md border border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{item.description}</p>
                    {item.owner && <p className="mt-1 text-xs text-muted-foreground">Owner: {item.owner.name}</p>}
                  </div>
                  <div className="shrink-0">
                    {item.task ? (
                      <Link href="/app/projects" className="flex items-center gap-2">
                        <span className="max-w-[160px] truncate text-xs font-medium text-muted-foreground">
                          {item.task.title}
                        </span>
                        <StatusBadge status={TASK_STATUS_TO_BADGE[item.task.status] ?? "pending"} />
                      </Link>
                    ) : (
                      <Badge variant="outline">No linked task</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Action Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionTimeline
            events={timelineEvents.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
