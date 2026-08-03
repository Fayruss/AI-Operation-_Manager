import { z } from "zod";

export const riskEntityTypeSchema = z.enum(["project", "task", "account"]);
export const riskSignalTypeSchema = z.enum(["sla_breach", "stale_task", "velocity_drop", "sentiment_negative"]);
export const riskSeveritySchema = z.enum(["low", "medium", "high"]);

export const listRiskSignalsQuerySchema = z.object({
  resolved: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  severity: riskSeveritySchema.optional()
});

/** SAD §5 `POST /risk-signals/:id/resolve` — no body required. */
export const resolveRiskSignalSchema = z.object({
  note: z.string().max(2000).optional()
});
