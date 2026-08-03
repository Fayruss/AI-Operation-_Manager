import "server-only";
import { createHash } from "node:crypto";
import { prisma, Prisma, type MemoryEmbeddingStatus } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";

/**
 * SAD §2.6/§4 `memory_entries` — Memory Module repository (Phase 7).
 *
 * `embedding` is declared `Unsupported("vector(1536)")` in schema.prisma,
 * which means Prisma Client excludes it entirely from the generated types
 * for every normal `findMany`/`create`/`update` call — there is no way to
 * read or write that column except raw SQL. This repository is therefore a
 * deliberate mix: Prisma Client for every non-vector column (type-safe,
 * consistent with every other repository in this directory), `$queryRaw`/
 * `$executeRaw` with `Prisma.sql` tagged templates (parameterized, not
 * string concatenation) for anything touching `embedding` or the cosine
 * distance operator (`<=>`).
 */

export interface MemoryEntryRow {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string | null;
  content: string;
  contentHash: string;
  embeddingStatus: MemoryEmbeddingStatus;
  embeddingModel: string | null;
  embeddingVersion: number | null;
  embeddingError: string | null;
  importance: number;
  sourceType: string;
  sourceRefId: string | null;
  metadata: Record<string, unknown> | null;
  accessCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchResult extends MemoryEntryRow {
  /** Cosine similarity (1 - cosine distance), 1.0 = identical direction. */
  similarity: number;
}

export interface UpsertMemoryCandidateInput {
  entityType: string;
  entityId: string | null;
  content: string;
  sourceType: string;
  sourceRefId: string | null;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryEntryFilters {
  entityType?: string;
  entityId?: string;
  sourceType?: string;
  q?: string;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Idempotency/dedup key (Phase 7 requirement §2/§3): stable across re-runs of the same consolidation window for the same source content. */
export function computeContentHash(orgId: string, entityType: string, entityId: string | null, content: string): string {
  return createHash("sha256").update(`${orgId}|${entityType}|${entityId ?? ""}|${content}`).digest("hex");
}

export const MemoryEntryRepository = {
  async list(orgId: string, filters: MemoryEntryFilters, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.memoryEntry.findMany({
      where: {
        orgId,
        entityType: filters.entityType,
        entityId: filters.entityId,
        sourceType: filters.sourceType,
        content: filters.q ? { contains: filters.q, mode: "insensitive" } : undefined,
        ...cursorWhere(cursor)
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  async getByIdInOrg(orgId: string, id: string) {
    const entry = await prisma.memoryEntry.findFirst({ where: { id, orgId } });
    if (!entry) {
      throw new ApiError("NOT_FOUND", "Memory entry not found", undefined, "MEMORY_ENTRY_NOT_FOUND");
    }
    return entry;
  },

  /** Memory Explorer "related memories" (Phase 7 requirement §6) — other entries about the same subject entity, most important first. */
  async listRelated(orgId: string, entityType: string, entityId: string, excludeId: string, limit = 5) {
    return prisma.memoryEntry.findMany({
      where: { orgId, entityType, entityId, id: { not: excludeId } },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: limit
    });
  },

  /**
   * Duplicate detection and merging (Phase 7 requirement §3): if a row
   * with the same `(orgId, entityType, entityId, contentHash)` already
   * exists, it's the same source content seen again — bump importance
   * slightly (repetition is itself a mild relevance signal) and touch
   * `updatedAt` rather than inserting a duplicate row. Otherwise insert a
   * new `pending` row for the embedding pipeline to pick up.
   */
  async upsertCandidate(orgId: string, input: UpsertMemoryCandidateInput): Promise<{ entry: MemoryEntryRow; created: boolean }> {
    const contentHash = computeContentHash(orgId, input.entityType, input.entityId, input.content);

    // `findFirst` rather than `findUnique` on the `uq_memory_dedup`
    // compound index deliberately: `entityId` is nullable, and Postgres
    // unique constraints don't enforce uniqueness across NULLs, so the DB
    // itself doesn't guarantee at-most-one-row for that case — relying on
    // `findUnique`'s single-row assumption here would be unsafe.
    // `findFirst` is correct for both the null- and non-null-entityId cases
    // and this function is the sole write path that could create a
    // duplicate, so "first match wins, then merge" is a safe dedup
    // strategy regardless.
    const match = await prisma.memoryEntry.findFirst({
      where: { orgId, entityType: input.entityType, entityId: input.entityId, contentHash }
    });

    if (match) {
      const merged = await prisma.memoryEntry.update({
        where: { id: match.id },
        data: {
          importance: Math.min(1, match.importance + 0.05),
          metadata: input.metadata ? toJsonInput({ ...(match.metadata as object | null), ...input.metadata }) : undefined
        }
      });
      return { entry: merged as MemoryEntryRow, created: false };
    }

    const created = await prisma.memoryEntry.create({
      data: {
        orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        content: input.content,
        contentHash,
        importance: input.importance ?? 0.5,
        sourceType: input.sourceType,
        sourceRefId: input.sourceRefId,
        metadata: input.metadata ? toJsonInput(input.metadata) : undefined,
        embeddingStatus: "pending"
      }
    });
    return { entry: created as MemoryEntryRow, created: true };
  },

  /** Embedding pipeline (Phase 7 requirement §2): entries awaiting a vector for one org, oldest first — bounded batch size, called repeatedly until empty. Always org-scoped; every call site (embedding-pipeline.ts) passes a concrete `orgId` — see that file's doc comment for why a cross-org sweep isn't offered here. */
  async listPendingEmbeddings(orgId: string, limit: number) {
    return prisma.memoryEntry.findMany({
      where: { orgId, embeddingStatus: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  },

  /** "Rebuild embeddings" (Phase 7 requirement §7 API): entries embedded with a stale model/version, or previously failed. */
  async listStaleEmbeddings(orgId: string, currentModel: string, currentVersion: number, limit: number) {
    return prisma.memoryEntry.findMany({
      where: {
        orgId,
        OR: [
          { embeddingStatus: "failed" },
          { embeddingStatus: "embedded", embeddingModel: { not: currentModel } },
          { embeddingStatus: "embedded", embeddingVersion: { not: currentVersion } }
        ]
      },
      orderBy: { createdAt: "asc" },
      take: limit
    });
  },

  /** Marks a batch of entries as pending again ahead of a forced rebuild (model/version bump). */
  async markPendingForRebuild(orgId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.memoryEntry.updateMany({
      where: { orgId, id: { in: ids } },
      data: { embeddingStatus: "pending", embeddingError: null }
    });
  },

  /**
   * Writes the computed vector for one entry via raw SQL (the only way to
   * touch an `Unsupported` column) and marks it embedded. `Prisma.sql` with
   * a parameterized value avoids string-building the vector literal by
   * hand for anything user/content-derived — only the numeric embedding
   * array (never user text) is interpolated into the vector literal here.
   *
   * Not org-scoped in the WHERE clause by itself — safe because `id` only
   * ever comes from an already org-scoped read in the same call chain
   * (`listPendingEmbeddings(orgId, ...)` in embedding-pipeline.ts), the
   * same "verify via a scoped read, then mutate by primary key" pattern
   * `RiskSignalRepository.resolve` and `remove` (below) use elsewhere in
   * this file.
   */
  async writeEmbedding(id: string, embedding: number[], model: string, version: number): Promise<void> {
    const vectorLiteral = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE memory_entries
      SET embedding = ${vectorLiteral}::vector,
          embedding_status = 'embedded',
          embedding_model = ${model},
          embedding_version = ${version},
          embedding_error = null,
          updated_at = now()
      WHERE id = ${id}::uuid
    `;
  },

  /** Same id-only-mutation safety basis as `writeEmbedding` above. */
  async markEmbeddingFailed(id: string, error: string): Promise<void> {
    await prisma.memoryEntry.update({
      where: { id },
      data: { embeddingStatus: "failed", embeddingError: error.slice(0, 2000) }
    });
  },

  /**
   * Semantic retrieval (Phase 7 requirement §4) — tenant-scoped top-k
   * cosine similarity search with optional metadata filtering. Cosine
   * distance operator `<=>` matches the ivfflat index's `vector_cosine_ops`
   * (packages/database/sql/009_memory_pgvector.sql); similarity = 1 - distance.
   * Only rows with a computed embedding are eligible (`embedding is not
   * null`, i.e. `embedding_status = 'embedded'`) — a pending/failed row
   * has nothing to compare against.
   */
  async search(
    orgId: string,
    queryEmbedding: number[],
    options: { entityType?: string; entityId?: string; sourceType?: string; minImportance?: number; topK: number }
  ): Promise<MemorySearchResult[]> {
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;

    const filters = Prisma.sql`
      org_id = ${orgId}::uuid
      AND embedding IS NOT NULL
      ${options.entityType ? Prisma.sql`AND entity_type = ${options.entityType}` : Prisma.empty}
      ${options.entityId ? Prisma.sql`AND entity_id = ${options.entityId}` : Prisma.empty}
      ${options.sourceType ? Prisma.sql`AND source_type = ${options.sourceType}` : Prisma.empty}
      ${options.minImportance !== undefined ? Prisma.sql`AND importance >= ${options.minImportance}` : Prisma.empty}
    `;

    const rows = await prisma.$queryRaw<
      (MemoryEntryRow & { similarity: number })[]
    >(Prisma.sql`
      SELECT
        id, org_id AS "orgId", entity_type AS "entityType", entity_id AS "entityId",
        content, content_hash AS "contentHash", embedding_status AS "embeddingStatus",
        embedding_model AS "embeddingModel", embedding_version AS "embeddingVersion",
        embedding_error AS "embeddingError", importance, source_type AS "sourceType",
        source_ref_id AS "sourceRefId", metadata, access_count AS "accessCount",
        last_accessed_at AS "lastAccessedAt", created_at AS "createdAt", updated_at AS "updatedAt",
        1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM memory_entries
      WHERE ${filters}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${options.topK}
    `);

    return rows;
  },

  /** Touches access bookkeeping for entries actually surfaced to an agent/user (drives decay's "untouched" definition). Same id-only-mutation safety basis as `writeEmbedding` — `ids` only ever come from `search()`'s already org-scoped results (memory-retrieval-service.ts). */
  async recordAccess(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.memoryEntry.updateMany({
      where: { id: { in: ids } },
      data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() }
    });
  },

  /**
   * Memory decay (Phase 7 requirement §3): entries untouched for the given
   * number of days (by `lastAccessedAt`, falling back to `createdAt` if
   * never accessed) have their importance multiplied by `factor`, floored
   * at `floor` so decay approaches-but-never-reaches zero (a fully-zeroed
   * entry would be indistinguishable from a deleted one in the UI, which
   * isn't the intent — low-importance-but-visible is). Bulk raw SQL for
   * efficiency (Phase 7 requirement: nightly job over potentially large
   * tables, not one UPDATE per row).
   */
  async decayStaleImportance(orgId: string, staleDays: number, factor: number, floor: number): Promise<number> {
    const result = await prisma.$executeRaw`
      UPDATE memory_entries
      SET importance = GREATEST(${floor}, importance * ${factor})
      WHERE org_id = ${orgId}::uuid
        AND COALESCE(last_accessed_at, created_at) < now() - (${staleDays}::text || ' days')::interval
        AND importance > ${floor}
    `;
    return Number(result);
  },

  async remove(orgId: string, id: string): Promise<void> {
    await this.getByIdInOrg(orgId, id);
    await prisma.memoryEntry.delete({ where: { id } });
  },

  async countByOrg(orgId: string): Promise<number> {
    return prisma.memoryEntry.count({ where: { orgId } });
  },

  async countByEmbeddingStatus(orgId: string, status: MemoryEmbeddingStatus): Promise<number> {
    return prisma.memoryEntry.count({ where: { orgId, embeddingStatus: status } });
  }
};
