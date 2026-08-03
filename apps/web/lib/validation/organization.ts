import { z } from "zod";

/**
 * `plan` is intentionally not editable here — it's billing-controlled
 * (SAD §4 `organizations.plan`), not a user-facing Settings field in this
 * phase. `roiHourlyCostUsd` is (SAD §13.4: "editable in Settings so it
 * reflects the org's own baseline rather than a marketing number").
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1, "name is required").max(200).optional(),
  roiHourlyCostUsd: z.number().positive().max(10000).optional()
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
