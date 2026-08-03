import { AlertCircle, AlertTriangle, GitBranch, LayoutGrid, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskSignalFeed } from "@/components/risk/risk-signal-feed";
import { getAuthContext } from "@/lib/auth/session";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";
import type { RiskSignalDto } from "@/lib/api/dto";

/**
 * SAD §7.4 Operations Dashboard — "Risk Signal feed (severity-sorted
 * list)." Heat map and dependency graph (§7.4's other two widgets) stay
 * designed empty states — they need task-completion-density and
 * dependency-graph data this phase doesn't build; the risk feed is the
 * live-data integration this phase explicitly scopes.
 *
 * Server Component fetches the initial page (no loading flash); the feed
 * itself is a Client Component (RiskSignalFeed) so resolving a signal
 * updates live via TanStack Query without a full page reload.
 */
export default async function OperationsPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Operations" description="Sign in to view risk signals." />
      </div>
    );
  }

  const [signalsPage, highCount, mediumCount, lowCount] = await Promise.all([
    RiskSignalRepository.list(ctx.orgId, { resolved: false }, null, 100),
    RiskSignalRepository.countActive(ctx.orgId, "high"),
    RiskSignalRepository.countActive(ctx.orgId, "medium"),
    RiskSignalRepository.countActive(ctx.orgId, "low")
  ]);

  // Server → Client boundary: the repository returns Prisma-shaped rows
  // (real Date objects); RiskSignalFeed's initialData prop is typed as the
  // client-safe DTO (ISO strings), matching what the API route itself
  // returns after NextResponse.json() serialization.
  const initialData = {
    items: signalsPage.items.map(
      (signal): RiskSignalDto => ({
        id: signal.id,
        orgId: signal.orgId,
        entityType: signal.entityType,
        entityId: signal.entityId,
        signalType: signal.signalType,
        severity: signal.severity,
        detail: signal.detail as unknown as Record<string, unknown>,
        resolved: signal.resolved,
        createdAt: signal.createdAt.toISOString()
      })
    ),
    nextCursor: signalsPage.nextCursor
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Operations" description="Heat map, risk signal feed, cross-project dependency graph." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Critical/High risks" value={highCount} icon={AlertCircle} />
        <KpiCard label="Medium risks" value={mediumCount} icon={AlertTriangle} />
        <KpiCard label="Low risks" value={lowCount} icon={ShieldAlert} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Risk Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskSignalFeed initialData={initialData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Team Workload Heat Map</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={LayoutGrid} title="Not built yet" description="Day × team completion density is a future enhancement." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dependency Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={GitBranch} title="Not built yet" description="Cross-project blocking chains are a future enhancement." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
