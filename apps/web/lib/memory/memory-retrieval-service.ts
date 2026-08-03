import "server-only";
import { MemoryEntryRepository, type MemorySearchResult } from "@/lib/repositories/memory-entry-repository";
import { getEmbeddingProvider, EmbeddingApiError } from "@/lib/ai/embedding-client";

/**
 * SAD §2.6/§13.1: "a query is just a SQL query with tenant filters" —
 * this is the single retrieval seam every agent (Phase 7 requirement §5:
 * "Shared retrieval layer for all agents") and, eventually, the Chat
 * Workspace (SAD §13.1, Phase 9 scope) call through. No agent module talks
 * to MemoryEntryRepository directly — this is the one place embedding a
 * query + running the similarity search + recording access happens
 * (CLAUDE.md: "never duplicate logic").
 */

export interface RetrieveMemoryOptions {
  entityType?: string;
  entityId?: string;
  sourceType?: string;
  /** Default 5 — SAD §13.1's reasoning applies here too: "a company with 50k tasks can't stuff them all into context," small top-k keeps agent prompts bounded. */
  topK?: number;
  minImportance?: number;
}

export interface MemoryContextItem {
  id: string;
  entityType: string;
  entityId: string | null;
  content: string;
  importance: number;
  similarity: number;
  sourceType: string;
  sourceRefId: string | null;
}

function toContextItem(row: MemorySearchResult): MemoryContextItem {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    content: row.content,
    importance: row.importance,
    similarity: row.similarity,
    sourceType: row.sourceType,
    sourceRefId: row.sourceRefId
  };
}

/**
 * Embeds `queryText` and returns the top-k most similar memory entries for
 * `orgId`, optionally filtered by entity/source. Every call records access
 * on the entries it returns (drives decay's "untouched" definition, Phase
 * 7 requirement §3) — fire-and-forget is deliberately *not* used here: a
 * lost access-count update is low-stakes, but awaiting it keeps this
 * function's behavior fully deterministic for tests, at negligible latency
 * cost (one indexed `UPDATE ... WHERE id IN (...)`).
 *
 * Returns an empty array (never throws) on embedding-provider failure —
 * retrieval augmenting a prompt is a quality improvement, not a
 * correctness requirement; an agent whose Claude call would otherwise
 * succeed should not fail outright just because memory retrieval is
 * degraded. Callers that need to distinguish "no relevant memory" from
 * "retrieval failed" can inspect the returned `degraded` flag.
 */
export async function retrieveMemoryContext(
  orgId: string,
  queryText: string,
  options: RetrieveMemoryOptions = {}
): Promise<{ items: MemoryContextItem[]; degraded: boolean }> {
  if (!queryText.trim()) {
    return { items: [], degraded: false };
  }

  let queryEmbedding: number[];
  try {
    const provider = getEmbeddingProvider();
    const result = await provider.embed([queryText]);
    const vector = result.embeddings[0];
    if (!vector) throw new EmbeddingApiError("Embedding provider returned no vector for the retrieval query.");
    queryEmbedding = vector;
  } catch (error) {
    console.error("[memory-retrieval] query embedding failed — returning empty context", error);
    return { items: [], degraded: true };
  }

  const rows = await MemoryEntryRepository.search(orgId, queryEmbedding, {
    entityType: options.entityType,
    entityId: options.entityId,
    sourceType: options.sourceType,
    minImportance: options.minImportance,
    topK: options.topK ?? 5
  });

  if (rows.length > 0) {
    await MemoryEntryRepository.recordAccess(rows.map((r) => r.id));
  }

  return { items: rows.map(toContextItem), degraded: false };
}

/**
 * Formats retrieved memory into a plain-text block suitable for inline
 * inclusion in an agent's user prompt (SAD §9's agents are all
 * structured-JSON-output Claude calls with a plain-text user prompt body —
 * see classifier-agent.ts's `buildUserPrompt`, etc.). Returns `null` when
 * there's nothing to inject so callers can omit the section entirely
 * rather than showing an empty "Relevant memory:" header.
 */
export function formatMemoryContext(items: MemoryContextItem[]): string | null {
  if (items.length === 0) return null;
  return items.map((item, i) => `${i + 1}. (${item.sourceType}, relevance ${(item.similarity * 100).toFixed(0)}%) ${item.content}`).join("\n");
}
