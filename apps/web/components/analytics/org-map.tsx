"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Network } from "lucide-react";
import { useOrgMap } from "@/lib/query/use-analytics";

const HEALTH_COLOR: Record<string, string> = {
  on_track: "hsl(142 71% 45%)",
  at_risk: "hsl(38 92% 55%)",
  critical: "hsl(0 72% 58%)"
};

/**
 * SAD §13.7 Organization Map — "React Flow graph... Node size/color
 * encodes workload or health... doubles as a workload-imbalance
 * detector." Layout: projects in a left column, people in a right
 * column, sized/positioned by index — simple deterministic layout
 * (SAD's own scope note: this reuses existing health/workload
 * computations, it doesn't need a force-directed layout engine to be
 * useful at the org sizes this product targets).
 */
export function OrgMap() {
  const { data, isLoading } = useOrgMap();

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!data) return { nodes: [], edges: [] };

    const projectNodes: Node[] = data.projects.map((project, i) => ({
      id: `project:${project.id}`,
      position: { x: 0, y: i * 110 },
      data: { label: `${project.name}\n${project.score}% complete` },
      style: {
        border: `2px solid ${HEALTH_COLOR[project.health] ?? "hsl(240 6% 20%)"}`,
        borderRadius: 8,
        padding: 10,
        background: "hsl(240 8% 10%)",
        color: "hsl(0 0% 98%)",
        fontSize: 12,
        whiteSpace: "pre-line",
        width: 200
      }
    }));

    const maxWorkload = Math.max(1, ...data.users.map((u) => u.openTaskCount));
    const userNodes: Node[] = data.users.map((user, i) => {
      const intensity = user.openTaskCount / maxWorkload;
      return {
        id: `user:${user.id}`,
        position: { x: 420, y: i * 80 },
        data: { label: `${user.name}\n${user.openTaskCount} open task${user.openTaskCount === 1 ? "" : "s"}` },
        style: {
          border: `2px solid ${intensity > 0.75 ? "hsl(0 72% 58%)" : intensity > 0.4 ? "hsl(38 92% 55%)" : "hsl(199 89% 60%)"}`,
          borderRadius: 999,
          padding: 8,
          background: "hsl(240 8% 10%)",
          color: "hsl(0 0% 98%)",
          fontSize: 12,
          whiteSpace: "pre-line",
          width: 160,
          textAlign: "center" as const
        }
      };
    });

    const flowEdges: Edge[] = data.edges.map((edge) => ({
      id: `${edge.userId}-${edge.projectId}`,
      source: `user:${edge.userId}`,
      target: `project:${edge.projectId}`,
      label: `${edge.openTaskCount}`,
      style: { stroke: "hsl(240 6% 30%)" },
      markerEnd: { type: MarkerType.ArrowClosed }
    }));

    return { nodes: [...projectNodes, ...userNodes], edges: flowEdges };
  }, [data]);

  if (isLoading) return <Skeleton className="h-[420px] w-full rounded-lg" />;

  if (!data || (data.users.length === 0 && data.projects.length === 0)) {
    return (
      <EmptyState
        icon={Network}
        title="No org data yet"
        description="Once people are assigned to project tasks, the org map shows workload and health at a glance."
      />
    );
  }

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-border">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background color="hsl(240 6% 20%)" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
