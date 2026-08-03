import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { parseJsonBody } from "@/lib/api/request";
import { listMemoryQuerySchema, createMemoryEntrySchema } from "@/lib/validation/memory";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";
import { writeAuditLog } from "@/lib/api/audit";

/** SAD §2.6/§13.6 Memory Explorer — "Filter by type/project/person" (Phase 7 requirement §6), "CRUD where appropriate" (§7). member+, matching every other read-heavy list endpoint (e.g. GET /tasks, GET /emails). */
export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const filters = listMemoryQuerySchema.parse({
    entityType: request.nextUrl.searchParams.get("entityType") ?? undefined,
    entityId: request.nextUrl.searchParams.get("entityId") ?? undefined,
    sourceType: request.nextUrl.searchParams.get("sourceType") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined
  });
  const page = await MemoryEntryRepository.list(ctx.orgId, filters, cursor, limit);
  return NextResponse.json(page);
});

/**
 * Manual memory entry creation — the Memory Explorer's "add a note"
 * affordance. Distinct from the automatic consolidation path
 * (memory-consolidation-service.ts): a manually-created entry has
 * `sourceType: "manual"` and is immediately queued for embedding (written
 * `pending`, picked up by the next embedding pipeline run — either the
 * nightly cron or an explicit rebuild-embeddings call) rather than
 * embedded synchronously in the request/response cycle, keeping this route
 * fast. admin+ (write access to organizational memory that every agent
 * reads from is a governance-relevant action, same tier as risk-signal
 * resolution).
 */
export const POST = apiRoute(
  async (request, ctx) => {
    const input = await parseJsonBody(request, createMemoryEntrySchema);
    const { entry } = await MemoryEntryRepository.upsertCandidate(ctx.orgId, {
      entityType: input.entityType,
      entityId: input.entityId,
      content: input.content,
      sourceType: "manual",
      sourceRefId: null,
      importance: input.importance,
      metadata: input.metadata
    });

    await writeAuditLog({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: "memory.entry_created",
      resourceType: "memory_entry",
      resourceId: entry.id,
      metadata: { entityType: entry.entityType, entityId: entry.entityId, sourceType: entry.sourceType }
    });

    return NextResponse.json(entry, { status: 201 });
  },
  { minRole: "admin" }
);
