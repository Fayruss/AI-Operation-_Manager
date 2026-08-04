import { BarChart3, Network, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeeklyTrendChart } from "@/components/shared/charts/weekly-trend-chart";
import { AiActionVolumeChart } from "@/components/shared/charts/ai-action-volume-chart";
import { RoiMetricsRow } from "@/components/analytics/roi-metrics-row";
import { OrgMap } from "@/components/analytics/org-map";
import { getAuthContext } from "@/lib/auth/session";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import type { AgentName } from "@ai-ops/types";

const WEEK_LABEL_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const AGENT_LABEL: Record<AgentName, string> = {
  classifier: "Classifier",
  summarizer: "Summarizer",
  risk: "Risk",
  report: "Report",
  reply_draft: "Reply Draft",
  memory: "Memory",
  chat: "Chat"
};

/**
 * SAD §7.7 Analytics Dashboard — "Cross-cutting Line/Area Charts (velocity
 * over time, AI-action volume, cost of AI usage), Org Chart (React Flow)
 * for team structure vs. workload correlation." Velocity + AI-volume are
 * fetched server-side (same Server Component pattern as the Executive
 * Dashboard); ROI metrics and the Org Map are client islands (their data
 * benefits from independent refresh/interactivity — see their own hooks).
 */
export default async function AnalyticsPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Sign in to view analytics." />
      </div>
    );
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [weeklyTrend, statusCounts] = await Promise.all([
    TaskRepository.getWeeklyTrend(ctx.orgId, 8),
    AgentRunRepository.getStatusCountsSince(ctx.orgId, since)
  ]);

  const weeklyTrendData = weeklyTrend.map((w) => ({
    week: w.weekStart.toLocaleDateString(undefined, WEEK_LABEL_FORMAT),
    created: w.created,
    completed: w.completed
  }));

  const agentVolume = (Object.keys(AGENT_LABEL) as AgentName[])
    .map((agentName) => {
      const rows = statusCounts.filter((s) => s.agentName === agentName);
      const total = rows.reduce((sum, r) => sum + r.count, 0);
      return {
        agent: AGENT_LABEL[agentName],
        success: rows.find((r) => r.status === "success")?.count ?? 0,
        failed: rows.find((r) => r.status === "failed")?.count ?? 0,
        awaitingApproval: rows.find((r) => r.status === "awaiting_approval")?.count ?? 0,
        total
      };
    })
    .filter((row) => row.total > 0);

  const hasAnyActivity = weeklyTrendData.some((w) => w.created > 0 || w.completed > 0) || agentVolume.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Velocity trend, AI action volume, ROI/time-saved metrics, and the organization map."
      />

      <RoiMetricsRow />

      {!hasAnyActivity ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={BarChart3}
              title="Not enough activity yet"
              description="Analytics populate once your team has task, email, and meeting history to analyze."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                Velocity Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyTrendChart data={weeklyTrendData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4" />
                AI Action Volume (90d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentVolume.length === 0 ? (
                <EmptyState icon={BarChart3} title="No agent activity yet" description="AI action volume appears once agents start running." />
              ) : (
                <AiActionVolumeChart data={agentVolume} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Network className="h-4 w-4" />
            Organization Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrgMap />
        </CardContent>
      </Card>
    </div>
  );
}
