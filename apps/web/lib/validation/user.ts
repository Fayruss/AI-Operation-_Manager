import { z } from "zod";

export const userRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

/** `PATCH /users/:id` — role changes only in this phase (profile fields land later). */
export const updateUserRoleSchema = z.object({
  role: userRoleSchema
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
