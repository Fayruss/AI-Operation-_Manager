import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, type Organization } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import type { UpdateOrganizationInput } from "@/lib/validation/organization";

export const OrganizationRepository = {
  async getById(orgId: string): Promise<Organization> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      // 404, not 403 — SAD §5: never leak cross-tenant existence either way.
      throw new ApiError("NOT_FOUND", "Organization not found");
    }
    return org;
  },

  /** Owner-only at the route layer — plan is billing-controlled and deliberately not editable here. */
  async update(orgId: string, actorId: string, input: UpdateOrganizationInput): Promise<Organization> {
    const existing = await this.getById(orgId);

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { name: input.name, roiHourlyCostUsd: input.roiHourlyCostUsd }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "organization.updated",
      resourceType: "organization",
      resourceId: orgId,
      metadata: {
        before: { name: existing.name, roiHourlyCostUsd: existing.roiHourlyCostUsd.toString() },
        after: { name: updated.name, roiHourlyCostUsd: updated.roiHourlyCostUsd.toString() }
      }
    });

    return updated;
  },

  /**
   * API Contract Pattern C's "org's webhook secret" for `POST
   * /meetings/ingest` — generated on first use rather than backfilled via a
   * migration (mirrors EmailAccountRepository.connect's per-account secret
   * generation, just org-scoped since there's no meeting-accounts table).
   */
  async getOrCreateMeetingWebhookSecret(orgId: string): Promise<string> {
    const org = await this.getById(orgId);
    if (org.meetingWebhookSecret) return org.meetingWebhookSecret;

    const secret = randomBytes(32).toString("hex");
    await prisma.organization.update({ where: { id: orgId }, data: { meetingWebhookSecret: secret } });
    return secret;
  },

  /**
   * Cron fan-out only (`GET /api/v1/cron/risk-scan` scans every org on a
   * schedule) — the one legitimate case for "every org's id" with no
   * tenant scope to filter by yet.
   */
  async listAllIds(): Promise<string[]> {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    return orgs.map((o) => o.id);
  },

  /** SAD §8.6 Memory Consolidation workflow checkpoint (Phase 7) — see `lastMemoryConsolidationAt`'s schema doc for why this is an org-level field rather than a separate tracking table. */
  async updateLastMemoryConsolidationAt(orgId: string, at: Date): Promise<void> {
    await prisma.organization.update({ where: { id: orgId }, data: { lastMemoryConsolidationAt: at } });
  }
};
