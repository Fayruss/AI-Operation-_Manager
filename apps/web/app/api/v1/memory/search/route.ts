import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { searchMemorySchema } from "@/lib/validation/memory";
import { retrieveMemoryContext } from "@/lib/memory/memory-retrieval-service";

/**
 * Semantic retrieval (Phase 7 requirement §4/§7) — the exact same
 * `retrieveMemoryContext` call every agent makes (memory-retrieval-service.ts),
 * exposed here for the Memory Explorer's search box and for manual
 * inspection/debugging of what an agent would see for a given query.
 */
export const POST = apiRoute(async (request, ctx) => {
  const input = await parseJsonBody(request, searchMemorySchema);
  const result = await retrieveMemoryContext(ctx.orgId, input.query, {
    entityType: input.entityType,
    entityId: input.entityId,
    sourceType: input.sourceType,
    minImportance: input.minImportance,
    topK: input.topK
  });
  return NextResponse.json(result);
});
