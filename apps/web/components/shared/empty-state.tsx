import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * SAD §6.6: "Empty states are designed, not blank... to avoid the dashboard
 * reading as broken." Every Phase-1 route stub uses this rather than a bare
 * placeholder.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  action
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/50 px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 rounded-full bg-surface-raised p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
