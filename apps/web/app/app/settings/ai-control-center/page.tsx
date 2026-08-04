import { Activity, AlertTriangle, Clock, Coins, Gauge, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalCenter } from "@/components/approvals/approval-center";
import { getAuthContext } from "@/lib/auth/session";
import { hasMinRole } from "@/lib/auth/rbac";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { notFound } from "next/navigation";

/** SAD §15's panels report over a recent operational window, not all time. */
const WINDOW_DAYS = 7;

function formatMs(value: number | null): string {
  if (value === null) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/**
 * SAD §15 AI Control Center (`/app/settings/ai-control-center`, admin+
 * only) — "a dedicated operational view of the AI layer itself... this is
 * engineering/ops-facing", distinct from the business-facing Analytics
 * Dashboard (§7.7).
 *
 * A Server Component reading the repositories directly, matching the
 * Settings page pattern: these are admin diagnostics with no client
 * interactivity beyond the approval queue, which is its own client island.
 *
 * Live-push panels ("Running agents... pushed via Realtime") render the
 * current count on each request; the Realtime subscription is deferred
 * because no Supabase Realtime channel is wired anywhere in this codebase
 * yet, and a fake subscription would be placeholder code.
 */
export default async function AiControlCenterPage() {
  const ctx = await getAuthContext().catch(() => null);

  // Admin+ only (SAD §15). `notFound()` rather than a 403 page, matching
  // this codebase's existing convention and SAD §5's "403 never used to
  // mask 404" corollary — a non-admin shouldn't learn this route exists.
  if (!ctx || !hasMinRole(ctx.role, "admin")) {
    notFound();
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [snapshot, statusCounts] = await Promise.all([
    AgentRunRepository.getControlCenterSnapshot(ctx.orgId, since),
    AgentRunRepository.getStatusCountsSince(ctx.orgId, since)
  ]);

  const totalRuns = statusCounts.reduce((sum, row) => sum + row.count, 0);
  const byAgent = new Map<string, { success: number; failed: number; total: number }>();
  for (const row of statusCounts) {
    const entry = byAgent.get(row.agentName) ?? { success: 0, failed: 0, total: 0 };
    if (row.status === "success") entry.success += row.count;
    if (row.status === "failed") entry.failed += row.count;
    entry.total += row.count;
    byAgent.set(row.agentName, entry);
  }

  const stats = [
    { label: "Running now", value: String(snapshot.inFlight), icon: Activity },
    { label: "Queued", value: String(snapshot.queued), icon: ListChecks },
    { label: "Latency p50", value: formatMs(snapshot.p50Ms), icon: Clock },
    { label: "Latency p95", value: formatMs(snapshot.p95Ms), icon: Gauge },
    {
      label: "Tokens (in / out)",
      value: `${formatTokens(snapshot.inputTokens)} / ${formatTokens(snapshot.outputTokens)}`,
      icon: Coins
    },
    { label: "Est. cost", value: `$${snapshot.estimatedCostUsd.toFixed(2)}`, icon: Coins }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Control Center"
        description={`Live agent status, queue, latency, cost, and approvals — last ${WINDOW_DAYS} days.`}
      />

      <section aria-labelledby="ops-snapshot-heading">
        <h2 id="ops-snapshot-heading" className="sr-only">
          Operational snapshot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-start justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-[28px] font-semibold leading-9">{stat.value}</p>
                </div>
                <div className="rounded-md bg-primary/10 p-2 text-primary" aria-hidden>
                  <stat.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {snapshot.sampleSize === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Latency percentiles need at least one completed run in the window.
          </p>
        )}
      </section>

      <section aria-labelledby="approvals-heading">
        <h2 id="approvals-heading" className="mb-3 text-lg font-semibold">
          Pending human approvals
        </h2>
        <ApprovalCenter />
      </section>

      <section aria-labelledby="agent-health-heading">
        <h2 id="agent-health-heading" className="mb-3 text-lg font-semibold">
          Per-agent health
        </h2>
        <Card>
          <CardContent className="p-6">
            {byAgent.size === 0 ? (
              <EmptyState
                icon={Activity}
                title="No agent activity in this window"
                description={`No agent has run in the last ${WINDOW_DAYS} days.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Success and failure counts per agent over the last {WINDOW_DAYS} days.
                  </caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="pb-2 font-medium text-muted-foreground">
                        Agent
                      </th>
                      <th scope="col" className="pb-2 font-medium text-muted-foreground">
                        Runs
                      </th>
                      <th scope="col" className="pb-2 font-medium text-muted-foreground">
                        Succeeded
                      </th>
                      <th scope="col" className="pb-2 font-medium text-muted-foreground">
                        Failed
                      </th>
                      <th scope="col" className="pb-2 font-medium text-muted-foreground">
                        Success rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(byAgent.entries()).map(([agentName, counts]) => {
                      const rate = counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0;
                      return (
                        <tr key={agentName} className="border-b border-border last:border-0">
                          <th scope="row" className="py-2 font-medium capitalize">
                            {agentName.replace(/_/g, " ")}
                          </th>
                          <td className="py-2">{counts.total}</td>
                          <td className="py-2">{counts.success}</td>
                          <td className="py-2">{counts.failed}</td>
                          <td className="py-2">
                            <Badge variant={rate >= 90 ? "success" : rate >= 70 ? "warning" : "danger"}>{rate}%</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="retry-heading">
        <Card>
          <CardHeader>
            <CardTitle id="retry-heading" className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />
              Retry distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.retryHistogram.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs recorded in this window.</p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Number of agent runs by retry count — a spike flags a specific agent or prompt regressing.
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="pb-2 font-medium text-muted-foreground">
                      Retries
                    </th>
                    <th scope="col" className="pb-2 font-medium text-muted-foreground">
                      Runs
                    </th>
                    <th scope="col" className="pb-2 font-medium text-muted-foreground">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.retryHistogram.map((bucket) => (
                    <tr key={bucket.retryCount} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 font-normal">
                        {bucket.retryCount}
                      </th>
                      <td className="py-2">{bucket.runs}</td>
                      <td className="py-2 text-muted-foreground">
                        {totalRuns > 0 ? `${Math.round((bucket.runs / totalRuns) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
