import { NextResponse } from "next/server";
import type { MemoryEntry } from "@ai-ops/database";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { rebuildEmbeddingsSchema } from "@/lib/validation/memory";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";
import { embedPendingEntries } from "@/lib/memory/embedding-pipeline";
import { getEmbeddingProvider, EMBEDDING_MODEL_VERSION } from "@/lib/ai/embedding-client";
import { writeAuditLog } from "@/lib/api/audit";

/**
 * "Rebuild embeddings" (Phase 7 requirement §7 API) — admin+. Two modes:
 *   - `entryIds` provided: re-flag exactly those entries `pending` (e.g.
 *     retrying specific `failed` rows surfaced in the Memory Explorer).
 *   - no body / empty `entryIds`: sweep every entry in the org whose
 *     `embeddingModel`/`embeddingVersion` doesn't match the currently
 *     configured provider (MemoryEntryRepository.listStaleEmbeddings) —
 *     the path a model upgrade uses.
 * Runs synchronously up to a bounded number of batches rather than
 * fire-and-forget: `after()` background execution (used by
 * memory-consolidation-service.ts's cron path) isn't appropriate here
 * because this is a user-triggered admin action that wants to see the
 * result immediately, not a scheduled job.
 */
export const POST = apiRoute(
  async (request, ctx) => {
    const input = await parseJsonBody(request, rebuildEmbeddingsSchema);
    const provider = getEmbeddingProvider();

    const targetIds =
      input.entryIds && input.entryIds.length > 0
        ? input.entryIds
        : (
            await MemoryEntryRepository.listStaleEmbeddings(ctx.orgId, provider.model, EMBEDDING_MODEL_VERSION, 500)
          ).map((entry: MemoryEntry) => entry.id);

    await MemoryEntryRepository.markPendingForRebuild(ctx.orgId, targetIds);
    const result = await embedPendingEntries(ctx.orgId, 25);

    await writeAuditLog({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: "memory.embeddings_rebuilt",
      resourceType: "organization",
      resourceId: ctx.orgId,
      metadata: { queued: targetIds.length, embedded: result.embedded, failed: result.failed }
    });

    return NextResponse.json({ queued: targetIds.length, embedded: result.embedded, failed: result.failed });
  },
  { minRole: "admin" }
);
