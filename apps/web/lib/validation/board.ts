import { z } from "zod";

export const boardTypeSchema = z.enum(["kanban", "sprint"]);

export const createBoardSchema = z.object({
  projectId: z.string().uuid("projectId must be a valid id"),
  name: z.string().min(1, "name is required").max(120),
  type: boardTypeSchema.default("kanban")
});
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
