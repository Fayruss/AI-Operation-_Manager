"use client";

import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReports } from "@/lib/query/use-reports";
import type { Page, ReportDto } from "@/lib/api/dto";

const STATUS_VARIANT = {
  generating: "info",
  complete: "success",
  complete_fallback: "warning",
  failed: "danger"
} as const;

const STATUS_LABEL = {
  generating: "Generating…",
  complete: "Complete",
  complete_fallback: "Complete (fallback)",
  failed: "Failed"
} as const;

/** SAD §7.6 "Report history table." Client island hydrated from the Server Component's initial fetch, same pattern as RiskSignalFeed (Phase 5). */
export function ReportsList({ initialData }: { initialData: Page<ReportDto> }) {
  const { data } = useReports(initialData);
  const reports = data.items;

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No reports generated yet"
        description="Weekly executive reports will appear here once the Reporting module runs, or generate one on demand."
      />
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/app/reports/${report.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium capitalize">{report.type.replace("_", " ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.periodStart && report.periodEnd
                  ? `${report.periodStart.slice(0, 10)} to ${report.periodEnd.slice(0, 10)}`
                  : new Date(report.createdAt).toLocaleDateString()}
                {" · "}
                <span className="capitalize">{report.generatedBy}</span>
              </p>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={STATUS_VARIANT[report.status]}>{STATUS_LABEL[report.status]}</Badge>
              {(report.status === "complete" || report.status === "complete_fallback") && (
                <Button asChild variant="secondary" size="sm">
                  <a href={`/api/v1/reports/${report.id}/download`}>
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
