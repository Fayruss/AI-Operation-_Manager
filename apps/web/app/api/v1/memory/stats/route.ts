import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";

/**
 * Memory Explorer overview counts — embedding pipeline health at a glance
 * (how much of organizational memory is actually retrievable right now).
 * Uses `MemoryEntryRepository.countByOrg`/`countByEmbeddingStatus`
 * (indexed `COUNT` queries via `idx_memory_org_embedding_status`), not a
 * full-table scan of `list()`.
 */
export const GET = apiRoute(async (_request, ctx) => {
  const [total, embedded, pending, failed] = await Promise.all([
    MemoryEntryRepository.countByOrg(ctx.orgId),
    MemoryEntryRepository.countByEmbeddingStatus(ctx.orgId, "embedded"),
    MemoryEntryRepository.countByEmbeddingStatus(ctx.orgId, "pending"),
    MemoryEntryRepository.countByEmbeddingStatus(ctx.orgId, "failed")
  ]);
  return NextResponse.json({ total, embedded, pending, failed });
});
