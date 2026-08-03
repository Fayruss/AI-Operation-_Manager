import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";
import { writeAuditLog } from "@/lib/api/audit";

/** Memory Explorer detail view (Phase 7 requirement §6: "Source tracing"). */
export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const entry = await MemoryEntryRepository.getByIdInOrg(ctx.orgId, id);
  return NextResponse.json(entry);
});

/**
 * Memory Explorer "delete/forget" action (SAD §13.6: "required for
 * reasonable data-governance posture, and logged to audit_log like any
 * other mutation"). admin+, matching the create endpoint's tier.
 */
export const DELETE = apiRoute<{ id: string }>(
  async (_request, ctx, { id }) => {
    const entry = await MemoryEntryRepository.getByIdInOrg(ctx.orgId, id);
    await MemoryEntryRepository.remove(ctx.orgId, id);

    await writeAuditLog({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: "memory.entry_deleted",
      resourceType: "memory_entry",
      resourceId: id,
      metadata: { entityType: entry.entityType, entityId: entry.entityId, sourceType: entry.sourceType }
    });

    return NextResponse.json({ id, deleted: true });
  },
  { minRole: "admin" }
);
