import "server-only";
import { prisma, type Prisma } from "@ai-ops/database";

export interface CreateNotificationInput {
  userId: string;
  type: string;
  payload: { title: string; description?: string; href?: string };
}

/**
 * First dedicated repository for the `notifications` table (it's existed
 * since Phase 1, but nothing had written to it yet until Phase 3/4's
 * inline `prisma.notification.create` calls in their respective services —
 * this is the proper home for that logic going forward; Phase 3/4's
 * existing call sites are left as-is per "don't rewrite existing work,"
 * this repository is for new code).
 */
export const NotificationRepository = {
  async createMany(orgId: string, notifications: CreateNotificationInput[]): Promise<void> {
    if (notifications.length === 0) return;
    await prisma.notification.createMany({
      data: notifications.map((n) => ({
        orgId,
        userId: n.userId,
        type: n.type,
        payload: n.payload as Prisma.InputJsonValue
      }))
    });
  }
};
