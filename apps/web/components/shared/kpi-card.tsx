"use client";

import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import type { KpiTrend } from "@ai-ops/types";

/**
 * Component Spec — KpiCard. The atomic unit of every dashboard's top row
 * (used across all seven dashboards, SAD §7). Pure presentational: data is
 * passed from the parent, no API calls of its own.
 */
export interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: KpiTrend;
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;
}

export function KpiCard({ label, value, trend, icon: Icon, loading, onClick }: KpiCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : ArrowRight;
  const isEmpty = value === 0 || value === "—";

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={cn(onClick && "cursor-pointer transition-colors hover:border-primary/50")}
    >
      <CardContent className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("mt-2 text-[28px] font-semibold leading-9", isEmpty && "text-muted-foreground")}>
            {value}
          </p>
          {trend && (
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-success" : "text-danger"
              )}
            >
              <TrendIcon className="h-3 w-3" />
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
