import Link from "next/link";
import { Trello } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusBadgeKey } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { getAuthContext } from "@/lib/auth/session";
import { ProjectRepository } from "@/lib/repositories/project-repository";

/**
 * SAD §6.1 `/app/projects` — project list, links into the Kanban detail
 * view. Server Component reading straight from the repository (same
 * pattern as every other list page since Phase 3) — previously shipped
 * against `mockProjects` despite the Task & Project Core API
 * (ProjectRepository, `POST/GET /api/v1/projects`) already being fully
 * implemented; fixed as part of the Phase 9 audit (CLAUDE.md: "fix every
 * issue found" during a phase's closing audit).
 */
export default async function ProjectsPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projects" description="Sign in to view your projects." />
      </div>
    );
  }

  const { items: projects } = await ProjectRepository.list(ctx.orgId, null, 50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Kanban boards, dependencies, burndown, and team workload per project."
        actions={<NewProjectButton />}
      />
      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Trello}
              title="No projects yet"
              description="Create your first project to start tracking boards and tasks."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/app/projects/${project.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex items-center justify-between">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Trello className="h-4 w-4" />
                    </div>
                    <StatusBadge status={project.health as StatusBadgeKey} />
                  </div>
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Target: {project.targetDate ? project.targetDate.toISOString().slice(0, 10) : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
