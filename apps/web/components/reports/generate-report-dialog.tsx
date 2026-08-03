"use client";

import { useState, type FormEvent } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGenerateReport, useReport } from "@/lib/query/use-reports";

function defaultPeriod(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * SAD §7.6 "on-demand 'Generate Report' with agent status (Live Workflow
 * Status indicator while the Report Agent runs)." API Contract Pattern B:
 * 202 immediately, then polls `GET /reports/:id` every 3s (useReport's
 * refetchInterval) until status leaves `generating`.
 */
export function GenerateReportDialog() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(defaultPeriod());
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const generateMutation = useGenerateReport();
  const pollQuery = useReport(activeReportId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    generateMutation.mutate(
      { type: "weekly_exec", periodStart: period.start, periodEnd: period.end },
      { onSuccess: (result) => setActiveReportId(result.reportId) }
    );
  }

  const status = pollQuery.data?.status;
  const isGenerating = activeReportId !== null && (status === undefined || status === "generating");

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActiveReportId(null);
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <FileText className="h-4 w-4" />
          Generate report
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Generate report</SheetTitle>
        </SheetHeader>

        {!activeReportId ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="periodStart">Period start</Label>
              <Input
                id="periodStart"
                type="date"
                value={period.start}
                onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periodEnd">Period end</Label>
              <Input
                id="periodEnd"
                type="date"
                value={period.end}
                onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))}
                required
              />
            </div>
            {generateMutation.isError && (
              <p className="text-sm text-danger" role="alert">
                {generateMutation.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <SheetClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </SheetClose>
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? "Starting…" : "Generate"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            {isGenerating ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-medium">Generating report…</p>
                <p className="text-xs text-muted-foreground">Aggregating metrics, running the Report Agent, rendering the PDF.</p>
              </>
            ) : (
              <>
                <Badge variant={status === "complete" ? "success" : status === "complete_fallback" ? "warning" : "danger"}>
                  {status === "failed" ? "Failed" : "Ready"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {status === "failed" ? "Report generation failed — check Settings → Audit Log for details." : "Your report is ready."}
                </p>
                <SheetClose asChild>
                  <Button variant="secondary" size="sm">
                    Close
                  </Button>
                </SheetClose>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
