import Link from "next/link";
import { Calendar, CheckCircle2, ListChecks, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuthContext } from "@/lib/auth/session";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";
import { MeetingActionItemRepository } from "@/lib/repositories/meeting-action-item-repository";

/**
 * SAD §7.5 Meeting Dashboard — "Action-item conversion rate KPI (meetings →
 * tasks created), Meeting list with AI summary preview." Server Component
 * reading straight from the repository (same pattern as the Email
 * Dashboard, Phase 3).
 */
export default async function MeetingsPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meetings" description="Sign in to view meeting summaries." />
      </div>
    );
  }

  const { items: meetings } = await MeetingRepository.list(ctx.orgId, null, 50);

  if (meetings.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meetings" description="Calendar view, action-item conversion rate, AI summary previews." />
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Calendar}
              title="No meetings ingested yet"
              description="Once a transcript source (Zoom/Meet) is connected, summaries and action items will appear here."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Aggregate action-item conversion rate across the org (SAD §7.5 KPI).
  const meetingIds = meetings.map((m) => m.id);
  const { total: actionItemCount, linked: linkedCount } = await MeetingActionItemRepository.getConversionStats(meetingIds);
  const conversionRate = actionItemCount === 0 ? 0 : Math.round((linkedCount / actionItemCount) * 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Meetings" description={`${meetings.length} meeting${meetings.length === 1 ? "" : "s"} processed`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Meetings processed" value={meetings.length} icon={Calendar} />
        <KpiCard label="Action items extracted" value={actionItemCount} icon={ListChecks} />
        <KpiCard
          label="Action-item conversion rate"
          value={`${conversionRate}%`}
          icon={CheckCircle2}
          trend={{ direction: "flat", value: `${linkedCount}/${actionItemCount} linked to tasks`, isPositive: true }}
        />
      </div>

      <div className="space-y-3">
        {meetings.map((meeting) => (
          <Link key={meeting.id} href={`/app/meetings/${meeting.id}`}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{meeting.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(meeting.occurredAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </p>
                    {meeting.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{meeting.summary}</p>
                    ) : (
                      <p className="mt-2 text-sm italic text-muted-foreground">Summarizing…</p>
                    )}
                  </div>
                  {!meeting.summary && (
                    <Badge variant="outline" className="shrink-0">
                      <Users className="h-3 w-3" />
                      Processing
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
