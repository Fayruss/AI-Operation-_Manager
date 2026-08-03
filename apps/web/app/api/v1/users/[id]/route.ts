import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { updateUserRoleSchema } from "@/lib/validation/user";
import { UserRepository } from "@/lib/repositories/user-repository";
import { ApiError } from "@/lib/api/errors";

/**
 * Role changes (`PATCH /users/:id`) are owner/admin only — RBAC via
 * `minRole: "admin"`. Granting the `owner` role specifically is further
 * restricted to existing owners (an admin promoting someone to owner would
 * be a privilege escalation past their own level). Demoting the last owner
 * is blocked in the repository layer regardless of who's calling.
 */
export const PATCH = apiRoute<{ id: string }>(
  async (request, ctx, { id }) => {
    const input = await parseJsonBody(request, updateUserRoleSchema);

    if (input.role === "owner" && ctx.role !== "owner") {
      throw new ApiError("FORBIDDEN", "Only an owner can grant the owner role.");
    }

    const updated = await UserRepository.updateRole(ctx.orgId, id, input.role, ctx.userId);
    return NextResponse.json(updated);
  },
  { minRole: "admin" }
);

export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const user = await UserRepository.findByIdInOrg(ctx.orgId, id);
  return NextResponse.json(user);
});
