import { z } from "zod";

export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"]);
export const projectHealthSchema = z.enum(["on_track", "at_risk", "critical"]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  status: projectStatusSchema.default("active"),
  health: projectHealthSchema.default("on_track"),
  startDate: z.string().date().optional(),
  targetDate: z.string().date().optional()
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
