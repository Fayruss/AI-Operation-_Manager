"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VisuallyHiddenTable } from "@/components/shared/visually-hidden-table";

export interface ProjectHealthPoint {
  name: string;
  score: number;
  health: "on_track" | "at_risk" | "critical";
}

/**
 * SAD §7.1 Project Portfolio — "Horizontal bar (health by project)".
 * Design System §8: rounded corners (4px), status color per bar. Pure
 * presentational component — data comes from the Server Component parent.
 */
const HEALTH_COLOR: Record<string, string> = {
  on_track: "hsl(var(--success))",
  at_risk: "hsl(var(--warning))",
  critical: "hsl(var(--danger))"
};

export function ProjectHealthChart({ data }: { data: ProjectHealthPoint[] }) {
  return (
    <div>
      <div className="h-40 w-full" role="img" aria-label="Project health scores by project">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--surface-raised))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "12px"
              }}
              cursor={{ fill: "hsl(var(--surface-raised))" }}
            />
            <Bar dataKey="score" radius={4} barSize={16}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={HEALTH_COLOR[entry.health] ?? "hsl(var(--muted-foreground))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHiddenTable
        caption="Project health scores"
        columns={["Project", "Health score", "Status"]}
        rows={data.map((p) => [p.name, p.score, p.health.replace("_", " ")])}
      />
    </div>
  );
}
