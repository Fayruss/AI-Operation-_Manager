import "server-only";
import { prisma, type Project, type ProjectHealth } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validation/project";
import { cursorWhere, paginate, type CursorPosition, type Page } from "@/lib/api/pagination";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";

export const ProjectRepository = {
  async list(orgId: string, cursor: CursorPosition | null, limit: number): Promise<Page<Project>> {
    const rows = await prisma.project.findMany({
      where: { orgId, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  async getById(orgId: string, projectId: string): Promise<Project> {
    const project = await prisma.project.findFirst({ where: { id: projectId, orgId } });
    if (!project) {
      throw new ApiError("NOT_FOUND", "Project not found");
    }
    return project;
  },

  async create(orgId: string, actorId: string, input: CreateProjectInput): Promise<Project> {
    const project = await prisma.project.create({
      data: {
        orgId,
        name: input.name,
        status: input.status,
        health: input.health,
        startDate: input.startDate ? new Date(input.startDate) : null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null
      }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      metadata: { name: project.name }
    });

    return project;
  },

  async update(orgId: string, actorId: string, projectId: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await this.getById(orgId, projectId);

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        status: input.status,
        health: input.health,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined
      }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "project.updated",
      resourceType: "project",
      resourceId: projectId,
      metadata: { before: existing, after: updated }
    });

    return updated;
  },

  /**
   * SAD §5 `GET /projects/:id/health` — "Aggregated health score + risk
   * signals... computed, cached 5 min." `activeRiskCount` now queries real
   * `risk_signals` data (Phase 5's Operations Health & Risk Module closed
   * this gap — Phase 2 originally hardcoded it to 0 since the table didn't
   * exist yet). No caching layer yet ("cached 5 min" — still a future
   * enhancement once there's a cache store in the architecture).
   */
  async getHealth(orgId: string, projectId: string) {
    await this.getById(orgId, projectId);

    const boards = await prisma.board.findMany({ where: { orgId, projectId }, select: { id: true } });
    const boardIds = boards.map((b) => b.id);

    if (boardIds.length === 0) {
      return {
        projectId,
        taskCounts: { total: 0, done: 0, overdue: 0 },
        completionRate: 0,
        activeRiskCount: 0
      };
    }

    const [total, done, overdue, activeRiskCount] = await Promise.all([
      prisma.task.count({ where: { orgId, boardId: { in: boardIds }, deletedAt: null } }),
      prisma.task.count({ where: { orgId, boardId: { in: boardIds }, deletedAt: null, status: "done" } }),
      prisma.task.count({
        where: {
          orgId,
          boardId: { in: boardIds },
          deletedAt: null,
          status: { not: "done" },
          dueDate: { lt: new Date() }
        }
      }),
      RiskSignalRepository.countActiveForEntity(orgId, "project", projectId)
    ]);

    return {
      projectId,
      taskCounts: { total, done, overdue },
      completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
      activeRiskCount
    };
  },

  /**
   * SAD §7.1 Executive Dashboard "Project Portfolio" chart — health +
   * completion-rate "score" per project, batched (not one `getHealth` call
   * per project, to avoid N+1 queries on a dashboard that lists every
   * project at once).
   */
  async listWithHealthScores(orgId: string): Promise<{ id: string; name: string; health: ProjectHealth; score: number }[]> {
    const projects = await prisma.project.findMany({ where: { orgId }, select: { id: true, name: true, health: true } });
    if (projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const boards = await prisma.board.findMany({ where: { orgId, projectId: { in: projectIds } }, select: { id: true, projectId: true } });

    const results = await Promise.all(
      projects.map(async (project) => {
        const boardIds = boards.filter((b) => b.projectId === project.id).map((b) => b.id);
        if (boardIds.length === 0) return { ...project, score: 0 };
        const [total, done] = await Promise.all([
          prisma.task.count({ where: { orgId, boardId: { in: boardIds }, deletedAt: null } }),
          prisma.task.count({ where: { orgId, boardId: { in: boardIds }, deletedAt: null, status: "done" } })
        ]);
        return { ...project, score: total === 0 ? 0 : Math.round((done / total) * 100) };
      })
    );

    return results;
  },

  /** SAD §8.6 Memory Consolidation workflow — "high-signal events since last run... completed projects." Relies on `updatedAt` (audit fix, Phase 7) as the only available "became completed" timestamp; a project that flips completed→active→completed within one window is captured once, which is an acceptable simplification (no dedicated status-history table exists). */
  async listCompletedSince(orgId: string, since: Date, limit = 100): Promise<Project[]> {
    return prisma.project.findMany({
      where: { orgId, status: "completed", updatedAt: { gte: since } },
      orderBy: { updatedAt: "asc" },
      take: limit
    });
  }
};
