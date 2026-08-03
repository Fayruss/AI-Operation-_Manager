import { z } from "zod";

/**
 * API Contract Pattern A (`POST /tasks`) validation rules, reproduced
 * exactly: "title required, 1–200 chars; priority enum required; boardId
 * required...; dueDate optional, must be ISO 8601, must be ≥ now if provided."
 */
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const taskStatusSchema = z.enum(["backlog", "todo", "in_progress", "in_review", "done", "blocked"]);

const isoDateNotInPast = z
  .string()
  .datetime({ message: "dueDate must be a valid ISO 8601 datetime" })
  .refine((value) => new Date(value).getTime() >= Date.now(), { message: "dueDate must be ≥ now" });

export const createTaskSchema = z.object({
  boardId: z.string().uuid("boardId must be a valid id"),
  title: z.string().min(1, "title is required").max(200, "title must be 200 characters or fewer"),
  description: z.string().max(10_000).optional(),
  priority: taskPrioritySchema,
  assigneeId: z.string().uuid().optional(),
  dueDate: isoDateNotInPast.optional()
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * `PATCH /tasks/:id` — every field optional (partial update); `updatedAt` is
 * required so the repository can enforce optimistic concurrency (SAD §5:
 * "optimistic concurrency via updated_at", Test Plan §3 "concurrent edit
 * conflict test").
 */
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime({ message: "updatedAt is required for optimistic concurrency" })
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = z.object({
  boardId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: taskStatusSchema.optional()
});
