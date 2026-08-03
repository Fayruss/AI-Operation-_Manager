import { z } from "zod";

export const reportTypeSchema = z.enum(["weekly_exec", "project_status", "custom"]);
export const reportStatusSchema = z.enum(["generating", "complete", "complete_fallback", "failed"]);

/** API Contract Pattern B — `POST /reports/generate`. */
export const generateReportSchema = z.object({
  type: reportTypeSchema.default("weekly_exec"),
  periodStart: z.string().date(),
  periodEnd: z.string().date()
});
export type GenerateReportInput = z.infer<typeof generateReportSchema>;

export const listReportsQuerySchema = z.object({
  type: reportTypeSchema.optional()
});
