"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VisuallyHiddenTable } from "@/components/shared/visually-hidden-table";

export interface WeeklyTrendPoint {
  week: string;
  created: number;
  completed: number;
}

/**
 * SAD §7.1 Weekly Trend — "Line Chart (tasks completed vs created)".
 * Design System §8: 2px stroke, subtle area fill omitted here (plain line
 * per the trend spec, area fill reserved for Burndown per §7.2). Pure
 * presentational component — data comes from the Server Component parent
 * (app/app/dashboard/page.tsx), which computes it from real task history
 * (Phase 5) rather than this component owning any data fetching itself.
 */
export function WeeklyTrendChart({ data }: { data: WeeklyTrendPoint[] }) {
  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label="Weekly trend of tasks created versus completed">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="week"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface-raised))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "12px"
              }}
            />
            <Line
              type="monotone"
              dataKey="created"
              name="Created"
              stroke="hsl(var(--info))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-info" aria-hidden /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Completed
        </span>
      </div>
      <VisuallyHiddenTable
        caption="Weekly tasks created versus completed"
        columns={["Week", "Created", "Completed"]}
        rows={data.map((p) => [p.week, p.created, p.completed])}
      />
    </div>
  );
}
