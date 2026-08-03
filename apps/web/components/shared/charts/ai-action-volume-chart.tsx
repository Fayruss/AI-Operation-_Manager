"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VisuallyHiddenTable } from "@/components/shared/visually-hidden-table";

export interface AiActionVolumePoint {
  agent: string;
  success: number;
  failed: number;
  awaitingApproval: number;
}

/**
 * SAD §7.7/§13.4 Analytics Dashboard — "AI-action volume" cross-cutting
 * chart. Stacked per-agent success/failed/awaiting-approval counts, same
 * data the AI Control Center's "Success/failure rate... per agent" panel
 * (SAD §15) draws from — this is the business-facing view of the same
 * underlying `agent_runs` aggregate.
 */
export function AiActionVolumeChart({ data }: { data: AiActionVolumePoint[] }) {
  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label="AI agent run volume by outcome">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="agent" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface-raised))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "12px"
              }}
              cursor={{ fill: "hsl(var(--surface-raised))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="success" name="Success" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="awaitingApproval" name="Awaiting approval" stackId="a" fill="hsl(var(--info))" />
            <Bar dataKey="failed" name="Failed" stackId="a" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHiddenTable
        caption="AI agent run volume by outcome"
        columns={["Agent", "Success", "Awaiting approval", "Failed"]}
        rows={data.map((d) => [d.agent, d.success, d.awaitingApproval, d.failed])}
      />
    </div>
  );
}
