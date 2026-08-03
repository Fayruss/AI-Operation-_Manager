import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";

/** Memory Explorer "related memories" (Phase 7 requirement §6) — other entries about the same subject entity. */
export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const entry = await MemoryEntryRepository.getByIdInOrg(ctx.orgId, id);
  if (!entry.entityId) {
    return NextResponse.json([]);
  }
  const related = await MemoryEntryRepository.listRelated(ctx.orgId, entry.entityType, entry.entityId, id);
  return NextResponse.json(related);
});
