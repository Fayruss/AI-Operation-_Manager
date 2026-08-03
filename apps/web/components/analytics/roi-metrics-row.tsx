"use client";

import { Clock, DollarSign, Mail, ListChecks } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoiMetrics } from "@/lib/query/use-analytics";

/** SAD §13.4 — "Hours saved (today/week), Tasks automated, Meetings summarized, Emails processed, and a derived $ figure." */
export function RoiMetricsRow() {
  const { data, isLoading } = useRoiMetrics(30);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Hours saved (30d)"
        value={data.totalHoursSaved}
        icon={Clock}
        trend={{ direction: "up", value: `${data.totalMinutesSaved} min total`, isPositive: true }}
      />
      <KpiCard
        label="Estimated value"
        value={`$${data.estimatedValueUsd.toLocaleString()}`}
        icon={DollarSign}
        trend={{ direction: "flat", value: `at $${data.hourlyCostUsd}/hr`, isPositive: true }}
      />
      <KpiCard label="Emails processed" value={data.emailsProcessed} icon={Mail} />
      <KpiCard label="Tasks automated" value={data.tasksAutomated} icon={ListChecks} />
    </div>
  );
}
