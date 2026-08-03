import { notFound } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusBadgeKey } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { mockProjects } from "@/lib/mock/mock-data";

const BOARD_COLUMNS = ["Backlog", "To Do", "In Progress", "In Review", "Done"];

/**
 * SAD §7.2 Project Dashboard — Kanban is the primary work surface.
 * Column shells render here; drag-drop + real task data wire up in
 * Implementation Guide Phase 4 (Task & Project Core) via
 * `PATCH /api/v1/tasks/:id` (API Contract Pattern A).
 */
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = mockProjects.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description="Kanban board · Gantt/dependency view · burndown · team workload"
        actions={<StatusBadge status={project.health as StatusBadgeKey} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {BOARD_COLUMNS.map((column) => (
          <Card key={column} className="min-h-[220px]">
            <CardContent className="p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {column}
              </h3>
              <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                No tasks
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={LayoutGrid}
            title="Task creation connects in Phase 4"
            description="Once the Task & Project Core API is wired up, this board becomes fully interactive with drag-and-drop and optimistic updates."
          />
        </CardContent>
      </Card>
    </div>
  );
}
