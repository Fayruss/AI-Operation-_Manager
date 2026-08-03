import "server-only";
import { prisma, ActorType, type Prisma } from "@ai-ops/database";

/**
 * SAD §2.8/§4/§12: "Every AI-initiated mutation is traceable to an
 * agent_run_id" (Phase 3+) and every human mutation is traceable here.
 * `audit_log` is compliance-grade and append-only — this is the single
 * write path every repository mutation calls through (CLAUDE.md: "never
 * duplicate logic").
 */
export interface WriteAuditLogInput {
  orgId: string;
  actorId: string | null;
  actorType?: ActorType;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  // Metadata often carries Prisma model snapshots (Date fields etc.) which
  // aren't valid Prisma JSON input as-is — round-trip through JSON to get a
  // plain, storage-safe value.
  const metadata = input.metadata
    ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
    : ({} as Prisma.InputJsonValue);

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: input.actorType ?? ActorType.user,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata
    }
  });
}
