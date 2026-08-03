import { Activity, AlertTriangle, Gauge, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { WeeklyTrendChart } from "@/components/shared/charts/weekly-trend-chart";
import { ProjectHealthChart } from "@/components/shared/charts/project-health-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuthContext } from "@/lib/auth/session";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { calculateCompanyHealthScore } from "@/lib/risk/health-score";

const WEEK_LABEL_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/**
 * SAD §7.1 Executive Dashboard — Health Score, Active Risk KPIs, Project
 * Portfolio, Risk Timeline, Weekly Trend. Server Component reading
 * straight from the repositories (same pattern as every other dashboard
 * page since Phase 3) — every widget here is real data as of Phase 5's
 * Operations Health & Risk Module.
 */
export default async function ExecutiveDashboardPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Executive Dashboard" description="Sign in to view company health." />
      </div>
    );
  }

  const [highRisks, mediumRisks, lowRisks, slaBreachCount, overdueTasks, weeklyTrend, projectScores, { items: recentSignals }] = await Promise.all([
    RiskSignalRepository.countActive(ctx.orgId, "high"),
    RiskSignalRepository.countActive(ctx.orgId, "medium"),
    RiskSignalRepository.countActive(ctx.orgId, "low"),
    RiskSignalRepository.countActiveBySignalType(ctx.orgId, "sla_breach"),
    TaskRepository.countOverdue(ctx.orgId),
    TaskRepository.getWeeklyTrend(ctx.orgId, 6),
    ProjectRepository.listWithHealthScores(ctx.orgId),
    RiskSignalRepository.list(ctx.orgId, { resolved: false }, null, 5)
  ]);

  const totalActiveRisks = highRisks + mediumRisks + lowRisks;
  const healthScore = calculateCompanyHealthScore({ high: highRisks, medium: mediumRisks, low: lowRisks });

  const weeklyTrendData = weeklyTrend.map((w) => ({
    week: w.weekStart.toLocaleDateString(undefined, WEEK_LABEL_FORMAT),
    created: w.created,
    completed: w.completed
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        description="One-screen company health, rolling up project health, active risk, and throughput."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Company Health" value={`${healthScore}`} icon={Gauge} />
        <KpiCard
          label="Active Risks"
          value={totalActiveRisks}
          icon={AlertTriangle}
          trend={totalActiveRisks > 0 ? { direction: "flat", value: `${highRisks} high severity`, isPositive: false } : undefined}
        />
        <KpiCard label="Overdue Tasks" value={overdueTasks} icon={ListChecks} />
        <KpiCard label="SLA Breaches" value={slaBreachCount} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            {projectScores.length === 0 ? (
              <EmptyState icon={Activity} title="No projects yet" description="Create a project to see portfolio health here." />
            ) : (
              <ProjectHealthChart data={projectScores.map((p) => ({ name: p.name, score: p.score, health: p.health }))} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSignals.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No active risks"
                description="Newly detected risk signals will appear here as the scheduled scan runs."
              />
            ) : (
              <div className="space-y-2">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <span className="truncate text-sm">{signal.signalType.replace("_", " ")}</span>
                    <Badge variant={signal.severity === "high" ? "danger" : signal.severity === "medium" ? "warning" : "outline"}>
                      {signal.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyTrendChart data={weeklyTrendData} />
        </CardContent>
      </Card>
    </div>
  );
}
