import { AlertCircle, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Design System §6: StatusBadge — icon + color + text, never color alone
 * (Section 10 accessibility rule).
 */
const STATUS_CONFIG = {
  on_track: { label: "On Track", icon: CheckCircle2, variant: "success" as const },
  at_risk: { label: "At Risk", icon: AlertTriangle, variant: "warning" as const },
  critical: { label: "Critical", icon: AlertCircle, variant: "danger" as const },
  done: { label: "Done", icon: CheckCircle2, variant: "success" as const },
  blocked: { label: "Blocked", icon: XCircle, variant: "danger" as const },
  pending: { label: "Pending", icon: Clock, variant: "outline" as const }
};

export type StatusBadgeKey = keyof typeof STATUS_CONFIG;

export function StatusBadge({ status }: { status: StatusBadgeKey }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
