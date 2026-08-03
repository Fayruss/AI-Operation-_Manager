import "server-only";
import { prisma, type EmailMessage, type EmailIntent, type EmailUrgency } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";
import type { NormalizedEmail } from "@/lib/integrations/gmail-oauth";

export interface EmailFilters {
  status?: EmailMessage["status"];
  urgency?: EmailUrgency;
}

export const EmailMessageRepository = {
  /** SAD §8.6 Memory Consolidation workflow — "high-signal events since last run... important emails." "Important" = urgency high/critical (Classifier Agent output, SAD §9.1) and already processed (avoids memorializing something still mid-triage). */
  async listImportantSince(orgId: string, since: Date, limit = 200): Promise<EmailMessage[]> {
    return prisma.emailMessage.findMany({
      where: { orgId, urgency: { in: ["high", "critical"] }, status: { not: "unprocessed" }, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  },

  async list(orgId: string, filters: EmailFilters, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.emailMessage.findMany({
      where: { orgId, status: filters.status, urgency: filters.urgency, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  async getById(orgId: string, id: string): Promise<EmailMessage> {
    const message = await prisma.emailMessage.findFirst({ where: { id, orgId } });
    if (!message) {
      throw new ApiError("NOT_FOUND", "Email message not found", undefined, "EMAIL_MESSAGE_NOT_FOUND");
    }
    return message;
  },

  /**
   * Ingestion write (SAD §4 `email_messages`, n8n Workflow Spec §1 node 6:
   * "write email_messages row (both branches)"). KNOWN LIMITATION: the
   * documented schema has no provider-message-id column to dedupe on, so a
   * webhook redelivery could create a duplicate row — acceptable for this
   * foundation phase (Test Plan §6 load-test hardening is Phase 6 scope),
   * not silently swallowed since every row is still visible/auditable.
   */
  async createFromNormalizedEmail(orgId: string, accountId: string, normalized: NormalizedEmail): Promise<EmailMessage> {
    return prisma.emailMessage.create({
      data: {
        orgId,
        accountId,
        threadId: normalized.threadId,
        sender: normalized.sender,
        subject: normalized.subject,
        bodySnippet: normalized.bodySnippet.slice(0, 2000),
        receivedAt: normalized.receivedAt,
        status: "unprocessed"
      }
    });
  },

  /** n8n Workflow Spec §1: classifier writes urgency/intent and flips status to `processed`. */
  async applyClassification(
    id: string,
    result: { urgency: EmailUrgency; intent: EmailIntent }
  ): Promise<EmailMessage> {
    return prisma.emailMessage.update({
      where: { id },
      data: { urgency: result.urgency, intent: result.intent, status: "processed" }
    });
  },

  /** n8n Workflow Spec §1 failure handling: exhausted retries → `status='unprocessed'`, never silently dropped. */
  async markUnprocessed(id: string): Promise<void> {
    await prisma.emailMessage.update({ where: { id }, data: { status: "unprocessed" } });
  }
};
