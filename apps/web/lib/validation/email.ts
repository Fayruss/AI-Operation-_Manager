import { z } from "zod";

export const emailProviderSchema = z.enum(["gmail", "outlook"]);
export const emailStatusSchema = z.enum(["unprocessed", "processed", "archived"]);
export const emailUrgencySchema = z.enum(["low", "medium", "high", "critical"]);

export const listEmailsQuerySchema = z.object({
  status: emailStatusSchema.optional(),
  urgency: emailUrgencySchema.optional()
});

/** SAD §5 `POST /emails/:id/convert-to-task` — manual promotion, no body needed beyond an optional priority override. */
export const convertEmailToTaskSchema = z.object({
  boardId: z.string().uuid("boardId is required to know which board to create the task on"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium")
});
export type ConvertEmailToTaskInput = z.infer<typeof convertEmailToTaskSchema>;
