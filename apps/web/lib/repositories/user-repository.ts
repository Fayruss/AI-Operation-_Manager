import "server-only";
import { prisma } from "@ai-ops/database";
import type { UserRole } from "@ai-ops/types";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";

export const UserRepository = {
  async listByOrg(orgId: string) {
    return prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, orgId: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
    });
  },

  async findByIdInOrg(orgId: string, userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) {
      throw new ApiError("NOT_FOUND", "User not found");
    }
    return user;
  },

  /** Notification fan-out target when a signal has no more specific recipient (e.g. project-level risk). */
  async listAdmins(orgId: string): Promise<{ id: string }[]> {
    return prisma.user.findMany({ where: { orgId, role: { in: ["owner", "admin"] } }, select: { id: true } });
  },

  /**
   * Role changes are RBAC-sensitive: never allow demoting the last owner,
   * so an org can never end up with zero owners (unrecoverable state).
   */
  async updateRole(orgId: string, targetUserId: string, newRole: UserRole, actorId: string) {
    const target = await this.findByIdInOrg(orgId, targetUserId);

    if (target.role === "owner" && newRole !== "owner") {
      const ownerCount = await prisma.user.count({ where: { orgId, role: "owner" } });
      if (ownerCount <= 1) {
        throw new ApiError("CONFLICT", "Cannot remove the last owner of an organization.");
      }
    }

    const previousRole = target.role;
    const updated = await prisma.user.update({ where: { id: targetUserId }, data: { role: newRole } });

    await writeAuditLog({
      orgId,
      actorId,
      action: "user.role_updated",
      resourceType: "user",
      resourceId: targetUserId,
      metadata: { previousRole, newRole }
    });

    return updated;
  }
};
