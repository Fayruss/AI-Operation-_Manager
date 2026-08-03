import "server-only";
import { UserRepository } from "@/lib/repositories/user-repository";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";

/**
 * SAD §13.7 Organization Map — "React Flow graph, data assembled from
 * existing joins (users→projects→tasks)... no new tables." Pure
 * assembly: one query per existing repository, joined in memory. Layout
 * (x/y positions) is deliberately left to the client component — this
 * service returns domain data only, per CLAUDE.md's "keep business logic
 * separated from UI."
 */
export interface OrgMapUserNode {
  id: string;
  name: string;
  role: string;
  openTaskCount: number;
}

export interface OrgMapProjectNode {
  id: string;
  name: string;
  health: string;
  score: number;
}

export interface OrgMapEdge {
  userId: string;
  projectId: string;
  openTaskCount: number;
}

export interface OrgMapData {
  users: OrgMapUserNode[];
  projects: OrgMapProjectNode[];
  edges: OrgMapEdge[];
}

export async function getOrganizationMap(orgId: string): Promise<OrgMapData> {
  const [users, projects, workload] = await Promise.all([
    UserRepository.listByOrg(orgId),
    ProjectRepository.listWithHealthScores(orgId),
    TaskRepository.getWorkloadByAssignee(orgId)
  ]);

  const openTaskCountByUser = new Map<string, number>();
  for (const w of workload) {
    openTaskCountByUser.set(w.assigneeId, (openTaskCountByUser.get(w.assigneeId) ?? 0) + w.openTaskCount);
  }

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      openTaskCount: openTaskCountByUser.get(u.id) ?? 0
    })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, health: p.health, score: p.score })),
    edges: workload.map((w) => ({ userId: w.assigneeId, projectId: w.projectId, openTaskCount: w.openTaskCount }))
  };
}
