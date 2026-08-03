import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";

/**
 * SAD §15 AI Control Center (`/app/settings/ai-control-center`, admin+ only).
 * Route reserved in this phase's page map; live agent telemetry connects
 * once `agent_runs` exists (Phase 2+).
 */
export default function AiControlCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="AI Control Center" description="Live agent status, queue, latency, cost, and approvals." />
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={Activity}
            title="No AI agents running"
            description="This view activates once the first agent (Classifier, Phase 2) starts writing to agent_runs."
          />
        </CardContent>
      </Card>
    </div>
  );
}
