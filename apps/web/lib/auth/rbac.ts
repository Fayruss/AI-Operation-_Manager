import "server-only";
import type { UserRole } from "@ai-ops/types";
import { ApiError } from "@/lib/api/errors";

/**
 * SAD §4/§5/CLAUDE.md RBAC: owner > admin > member > viewer. Ordering
 * mirrors the `users.role` enum and the API Contract's per-endpoint "Auth"
 * column ("member+", "admin+", "owner/admin").
 */
const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3
};

export function hasMinRole(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * SAD §5 error handling standard: "403 always means authenticated but not
 * permitted, never used to mask 404." Callers are responsible for using 404
 * instead when the check is really about tenant/resource existence.
 */
export function requireMinRole(role: UserRole, min: UserRole): void {
  if (!hasMinRole(role, min)) {
    throw new ApiError("FORBIDDEN", `This action requires the '${min}' role or higher.`);
  }
}
