import { z } from "zod";

/** SAD §4 `memory_entries.entity_type` is free-text — validated as a bounded non-empty string, not a closed enum (see MemoryEntry's schema doc for the rationale). */
const entityTypeSchema = z.string().min(1).max(50);
const sourceTypeSchema = z.string().min(1).max(50);

/** GET /api/v1/memory — Memory Explorer list/filter (Phase 7 requirement §6: "Filter by type/project/person"). */
export const listMemoryQuerySchema = z.object({
  entityType: entityTypeSchema.optional(),
  entityId: z.string().uuid().optional(),
  sourceType: sourceTypeSchema.optional(),
  /** Free-text search over `content` — the non-semantic complement to POST /memory/search's embedding search, for exact-phrase lookups Memory Explorer's search box needs. */
  q: z.string().min(1).max(200).optional()
});
export type ListMemoryQuery = z.infer<typeof listMemoryQuerySchema>;

/** POST /api/v1/memory/search — semantic retrieval (Phase 7 requirement §4/§7), the same underlying call every agent makes via memory-retrieval-service.ts, exposed here for the Memory Explorer's search box and for manual inspection/debugging. */
export const searchMemorySchema = z.object({
  query: z.string().min(1).max(2000),
  entityType: entityTypeSchema.optional(),
  entityId: z.string().uuid().optional(),
  sourceType: sourceTypeSchema.optional(),
  minImportance: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(50).default(10)
});
/** Request payload type: `z.input` (not `z.infer`) so callers may omit `topK`, which carries a `.default()` applied by `parse` server-side. */
export type SearchMemoryInput = z.input<typeof searchMemorySchema>;

/** POST /api/v1/memory (manual entry) — Memory Explorer's "add a note" affordance and any future direct API integration. Distinct from the automatic consolidation path (memory-consolidation-service.ts), which writes with `sourceType` values the consolidation logic controls, not user input. */
export const createMemoryEntrySchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid().nullable().default(null),
  content: z.string().min(1).max(5000),
  importance: z.number().min(0).max(1).default(0.5),
  metadata: z.record(z.unknown()).optional()
});
/** Request payload type: `z.input` (not `z.infer`) so callers may omit fields carrying a `.default()` — `entityId` and `importance` are filled in by `parse` server-side. */
export type CreateMemoryEntryInput = z.input<typeof createMemoryEntrySchema>;

/** POST /api/v1/memory/rebuild-embeddings — admin+ (Phase 7 requirement §7). Empty body triggers a rebuild of every stale/failed entry for the org; `entryIds` scopes it to specific entries (e.g. retrying a known failure from the Memory Explorer UI). */
export const rebuildEmbeddingsSchema = z.object({
  entryIds: z.array(z.string().uuid()).max(500).optional()
});
export type RebuildEmbeddingsInput = z.infer<typeof rebuildEmbeddingsSchema>;
