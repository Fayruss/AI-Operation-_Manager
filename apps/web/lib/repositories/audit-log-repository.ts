import "server-only";
import { prisma } from "@ai-ops/database";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";

export interface AuditLogFilters {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
}

export const AuditLogRepository = {
  /** SAD §13.9 Action Timeline — bounded, unpaginated slice for one specific resource (distinct from the paginated admin-facing `list()` below). */
  async listForResource(orgId: string, resourceType: string, resourceId: string, limit = 100) {
    return prisma.auditLog.findMany({
      where: { orgId, resourceType, resourceId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  },

  /** SAD §5: `GET /audit-log` — "filterable by actor/resource", owner/admin only (enforced by the route handler's RBAC check). */
  async list(orgId: string, filters: AuditLogFilters, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.auditLog.findMany({
      where: {
        orgId,
        actorId: filters.actorId,
        resourceType: filters.resourceType,
        resourceId: filters.resourceId,
        ...cursorWhere(cursor)
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  }
};
