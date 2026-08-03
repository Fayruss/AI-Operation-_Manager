import { z } from "zod";

/**
 * Zod schemas are the single source of truth for both runtime validation and
 * inferred types (CLAUDE.md, SAD §12) — shared by the client form and the
 * server action.
 */
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  orgName: z.string().min(1, "Organization name is required").max(120),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
});
export type SignupInput = z.infer<typeof signupSchema>;
