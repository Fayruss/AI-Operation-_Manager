import "server-only";
import { prisma, ActorType, type Task, type Prisma } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/validation/task";
import { BoardRepository } from "@/lib/repositories/board-repository";

export interface TaskFilters {
  boardId?: string;
  assigneeId?: string;
  status?: Task["status"];
}

const TASK_SELECT = {
  id: true,
  orgId: true,
  boardId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  source: true,
  sourceRefId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  assignee: { select: { id: true, name: true, avatarUrl: true } }
} as const;

export const TaskRepository = {
  async list(orgId: string, filters: TaskFilters, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.task.findMany({
      where: {
        orgId,
        deletedAt: null,
        boardId: filters.boardId,
        assigneeId: filters.assigneeId,
        status: filters.status,
        ...cursorWhere(cursor)
      },
      select: TASK_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  /**
   * SAD §13.1 Chat Workspace grounding — "pulls supplementary live rows
   * (open tasks... for entities mentioned)." Not the full `list()` filter
   * set: this is a bounded, keyword-matched-with-fallback query built
   * specifically to hand the Chat Agent a small set of *real* candidate
   * tasks (with real IDs) to ground its `referenced_entity_indices`
   * against — see chat-agent.ts.
   */
  async searchForGrounding(orgId: string, keywords: string[], limit = 8) {
    const keywordFilter: Prisma.TaskWhereInput[] =
      keywords.length > 0
        ? keywords.map((word) => ({ title: { contains: word, mode: "insensitive" as const } }))
        : [];

    const matched =
      keywordFilter.length > 0
        ? await prisma.task.findMany({
            where: { orgId, deletedAt: null, status: { not: "done" }, OR: keywordFilter },
            select: TASK_SELECT,
            orderBy: { updatedAt: "desc" },
            take: limit
          })
        : [];

    if (matched.length >= limit) return matched;

    // Fallback/fill: most recently active open tasks, excluding ones already matched.
    const filler = await prisma.task.findMany({
      where: { orgId, deletedAt: null, status: { not: "done" }, id: { notIn: matched.map((t) => t.id) } },
      select: TASK_SELECT,
      orderBy: { updatedAt: "desc" },
      take: limit - matched.length
    });

    return [...matched, ...filler];
  },

  /** SAD §13.9 Action Timeline — "product-facing history" half of the merge (task_activity), oldest first. */
  async listActivityForTask(orgId: string, taskId: string, limit = 100) {
    // Ownership check first — a task_activity row has no org_id column of
    // its own (scoped via task_id, same precedent as chat_messages→
    // chat_sessions), so confirm the task belongs to this org before
    // returning its activity.
    await this.getById(orgId, taskId);
    return prisma.taskActivity.findMany({
      where: { taskId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  },

  async getById(orgId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, orgId, deletedAt: null },
      select: TASK_SELECT
    });
    if (!task) {
      throw new ApiError("NOT_FOUND", "Task not found", undefined, "TASK_NOT_FOUND");
    }
    return task;
  },

  async create(orgId: string, actorId: string, input: CreateTaskInput) {
    // API Contract Pattern A: boardId must resolve to a board within the
    // caller's org — explicit 404 at the API layer, never a bare DB FK error.
    // Reuses BoardRepository so this lookup/error-shape lives in one place.
    await BoardRepository.getById(orgId, input.boardId);

    if (input.assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: input.assigneeId, orgId } });
      if (!assignee) {
        throw new ApiError("VALIDATION_ERROR", "assigneeId does not belong to this organization", {
          field: "assigneeId"
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        orgId,
        boardId: input.boardId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        source: "manual"
      },
      select: TASK_SELECT
    });

    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId, actorType: ActorType.user, action: "created" }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "task.created",
      resourceType: "task",
      resourceId: task.id,
      metadata: { title: task.title, boardId: task.boardId }
    });

    return task;
  },

  /**
   * SAD §5 / Test Plan §3: optimistic concurrency via `updated_at`. The
   * caller must supply the `updatedAt` they last read; if it doesn't match
   * the current row, another writer got there first.
   */
  async update(orgId: string, actorId: string, taskId: string, input: UpdateTaskInput) {
    const existing = await this.getById(orgId, taskId);

    if (existing.updatedAt.toISOString() !== input.updatedAt) {
      throw new ApiError(
        "CONFLICT",
        "This task was modified by someone else — reload and try again.",
        { currentUpdatedAt: existing.updatedAt.toISOString() },
        "STALE_UPDATE"
      );
    }

    if (input.assigneeId) {
      const assignee = await prisma.user.findFirst({ where: { id: input.assigneeId, orgId } });
      if (!assignee) {
        throw new ApiError("VALIDATION_ERROR", "assigneeId does not belong to this organization", {
          field: "assigneeId"
        });
      }
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null
      },
      select: TASK_SELECT
    });

    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of ["title", "description", "status", "priority", "assigneeId", "dueDate"] as const) {
      if (input[field] !== undefined && existing[field as keyof typeof existing] !== updated[field as keyof typeof updated]) {
        diff[field] = { before: existing[field as keyof typeof existing], after: updated[field as keyof typeof updated] };
      }
    }
    // Round-trip through JSON: diff may contain Date objects (dueDate) which
    // aren't valid Prisma JSON input as-is (same reasoning as writeAuditLog).
    const serializedDiff = JSON.parse(JSON.stringify(diff)) as Prisma.InputJsonValue;

    await prisma.taskActivity.create({
      data: { taskId, actorId, actorType: ActorType.user, action: "updated", diff: serializedDiff }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "task.updated",
      resourceType: "task",
      resourceId: taskId,
      metadata: diff
    });

    return updated;
  },

  /** Soft-delete only — API Contract: "never hard-deletes." Role check (admin+) happens in the route handler. */
  async softDelete(orgId: string, actorId: string, taskId: string): Promise<void> {
    await this.getById(orgId, taskId);

    await prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });

    await prisma.taskActivity.create({
      data: { taskId, actorId, actorType: ActorType.user, action: "deleted" }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "task.deleted",
      resourceType: "task",
      resourceId: taskId
    });
  },

  /**
   * AI-attributed task creation (SAD §4 `source`/`source_ref_id` — "traces
   * every AI-created task back to its origin email... required for trust
   * and for undo"). Kept separate from `create()` rather than adding
   * optional flags to it: the actor type (`ai_agent` vs `user`) and audit
   * metadata shape genuinely differ, and the human-facing `POST /tasks`
   * contract (API Contract Pattern A) shouldn't grow AI-only parameters.
   */
  /**
   * AI-attributed task creation (SAD §4 `source`/`source_ref_id` — "traces
   * every AI-created task back to its origin email/meeting... required for
   * trust and for undo"). Kept separate from `create()` rather than adding
   * optional flags to it: the actor type (`ai_agent` vs `user`) and audit
   * metadata shape genuinely differ, and the human-facing `POST /tasks`
   * contract (API Contract Pattern A) shouldn't grow AI-only parameters.
   * Shared between the Classifier (source='email') and Summarizer
   * (source='meeting') agents rather than duplicated per-agent.
   */
  async createFromAgent(
    orgId: string,
    boardId: string,
    agentRunId: string,
    input: { title: string; priority: CreateTaskInput["priority"]; source: "email" | "meeting"; sourceRefId: string }
  ) {
    await BoardRepository.getById(orgId, boardId);

    const task = await prisma.task.create({
      data: {
        orgId,
        boardId,
        title: input.title,
        priority: input.priority,
        source: input.source,
        sourceRefId: input.sourceRefId
      },
      select: TASK_SELECT
    });

    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId: null, actorType: ActorType.ai_agent, action: "created", diff: { agentRunId } }
    });

    await writeAuditLog({
      orgId,
      actorId: null,
      actorType: ActorType.ai_agent,
      action: input.source === "email" ? "task.created_from_email" : "task.created_from_meeting",
      resourceType: "task",
      resourceId: task.id,
      metadata: { title: task.title, boardId, agentRunId, source: input.source, sourceRefId: input.sourceRefId }
    });

    return task;
  },

  /**
   * SAD §5 `POST /emails/:id/convert-to-task` — human-initiated promotion.
   * Same `source='email'`/`sourceRefId` traceability as `createFromAgent`,
   * but attributed to the calling user (actorType `user`), which is the
   * one thing that genuinely differs — everything else about "create a task
   * with a non-manual source" would otherwise be duplicated.
   */
  async createFromEmailConversion(
    orgId: string,
    actorId: string,
    input: { boardId: string; title: string; description?: string; priority: CreateTaskInput["priority"]; sourceRefId: string }
  ) {
    await BoardRepository.getById(orgId, input.boardId);

    const task = await prisma.task.create({
      data: {
        orgId,
        boardId: input.boardId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        source: "email",
        sourceRefId: input.sourceRefId
      },
      select: TASK_SELECT
    });

    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId, actorType: ActorType.user, action: "created" }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "email.converted_to_task",
      resourceType: "task",
      resourceId: task.id,
      metadata: { emailMessageId: input.sourceRefId, boardId: input.boardId }
    });

    return task;
  },

  /**
   * SAD §2.4/§8.4 Risk Detection — "stale tasks (no update > project's
   * threshold)". Joins through board→project so each candidate carries the
   * project's health (used as "criticality" input to severity.ts's
   * calculateStaleTaskSeverity).
   */
  async findStaleCandidates(orgId: string, thresholdDays: number) {
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    return prisma.task.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["done"] },
        updatedAt: { lt: cutoff }
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        assigneeId: true,
        board: { select: { project: { select: { id: true, name: true, health: true } } } }
      }
    });
  },

  /** SAD §2.4/§8.4 Risk Detection — "SLA breach candidates" (overdue, not done). */
  async findSlaBreachCandidates(orgId: string) {
    return prisma.task.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { notIn: ["done"] },
        dueDate: { lt: new Date() }
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        board: { select: { project: { select: { id: true, name: true } } } }
      }
    });
  },

  /**
   * SAD §8.4: "7-day velocity trend per project... rolling 7-day
   * completion rate vs. prior period." Returns per-project completed-task
   * counts for the current window and the one before it.
   */
  async getVelocityByProject(orgId: string): Promise<{ projectId: string; projectName: string; current: number; previous: number }[]> {
    const now = new Date();
    const currentWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWindowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const completedTasks = await prisma.task.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: "done",
        updatedAt: { gte: previousWindowStart }
      },
      select: {
        updatedAt: true,
        board: { select: { project: { select: { id: true, name: true } } } }
      }
    });

    const byProject = new Map<string, { projectName: string; current: number; previous: number }>();
    for (const task of completedTasks) {
      const project = task.board.project;
      const entry = byProject.get(project.id) ?? { projectName: project.name, current: 0, previous: 0 };
      if (task.updatedAt >= currentWindowStart) {
        entry.current += 1;
      } else {
        entry.previous += 1;
      }
      byProject.set(project.id, entry);
    }

    return Array.from(byProject.entries()).map(([projectId, stats]) => ({ projectId, ...stats }));
  },

  /** SAD §7.1 Executive Dashboard "Weekly Trend (tasks completed vs created)" — last N weeks, org-wide. */
  async getWeeklyTrend(orgId: string, weeks = 6): Promise<{ weekStart: Date; created: number; completed: number }[]> {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    const [createdTasks, completedTasks] = await Promise.all([
      prisma.task.findMany({
        where: { orgId, createdAt: { gte: rangeStart } },
        select: { createdAt: true }
      }),
      prisma.task.findMany({
        where: { orgId, deletedAt: null, status: "done", updatedAt: { gte: rangeStart } },
        select: { updatedAt: true }
      })
    ]);

    const buckets: { weekStart: Date; created: number; completed: number }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      buckets.push({
        weekStart,
        created: createdTasks.filter((t) => t.createdAt >= weekStart && t.createdAt < weekEnd).length,
        completed: completedTasks.filter((t) => t.updatedAt >= weekStart && t.updatedAt < weekEnd).length
      });
    }
    return buckets;
  },

  /** SAD §7.1 Executive Dashboard "Overdue Tasks" KPI — org-wide, not scoped to one project (unlike ProjectRepository.getHealth). */
  /** SAD §13.4 ROI Metrics — "Tasks automated" KPI: any task whose `source` wasn't a manual UI create. */
  /**
   * SAD §13.7 Organization Map — "Node size/color encodes workload...
   * reusing Section 7.2/7.4's existing health computations so the map
   * doubles as a workload-imbalance detector." Open (non-done) task count
   * per assignee, plus which projects those tasks belong to (via board→
   * project) so the map can draw user↔project edges without a second
   * round-trip.
   */
  async getWorkloadByAssignee(orgId: string): Promise<{ assigneeId: string; projectId: string; openTaskCount: number }[]> {
    const rows = await prisma.task.findMany({
      where: { orgId, deletedAt: null, status: { not: "done" }, assigneeId: { not: null } },
      select: { assigneeId: true, board: { select: { projectId: true } } }
    });

    const counts = new Map<string, { assigneeId: string; projectId: string; openTaskCount: number }>();
    for (const row of rows) {
      if (!row.assigneeId) continue;
      const key = `${row.assigneeId}:${row.board.projectId}`;
      const existing = counts.get(key);
      if (existing) {
        existing.openTaskCount += 1;
      } else {
        counts.set(key, { assigneeId: row.assigneeId, projectId: row.board.projectId, openTaskCount: 1 });
      }
    }

    return Array.from(counts.values());
  },

  async countAutomatedSince(orgId: string, since: Date): Promise<number> {
    return prisma.task.count({
      where: { orgId, deletedAt: null, source: { not: "manual" }, createdAt: { gte: since } }
    });
  },

  async countOverdue(orgId: string): Promise<number> {
    return prisma.task.count({
      where: { orgId, deletedAt: null, status: { notIn: ["done"] }, dueDate: { lt: new Date() } }
    });
  },

  /**
   * SAD §2.5/§8.5 Reporting Module — "Aggregate period metrics." Unlike
   * getWeeklyTrend (last-N-weeks buckets relative to now), this scopes to
   * an arbitrary [periodStart, periodEnd] range, matching
   * `POST /reports/generate`'s caller-supplied period.
   */
  async getMetricsForPeriod(orgId: string, periodStart: Date, periodEnd: Date): Promise<{ created: number; completed: number }> {
    const [created, completed] = await Promise.all([
      prisma.task.count({ where: { orgId, createdAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.task.count({ where: { orgId, deletedAt: null, status: "done", updatedAt: { gte: periodStart, lte: periodEnd } } })
    ]);
    return { created, completed };
  }
};
