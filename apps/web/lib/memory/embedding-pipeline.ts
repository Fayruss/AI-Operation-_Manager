import "server-only";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";
import { getEmbeddingProvider, EmbeddingApiError } from "@/lib/ai/embedding-client";

/**
 * SAD §8.6 Memory Consolidation workflow, n8n Workflow Spec §6: "generate
 * embeddings... embeddings called in batches of 20... failed batches
 * logged and retried on the next nightly run rather than blocking the
 * whole consolidation... partial success is acceptable and expected."
 *
 * This module is the batch/retry/idempotency/versioning/background-
 * processing piece (Phase 7 requirement §2), deliberately separate from
 * memory-consolidation-service.ts (requirement §3, which decides *what*
 * becomes a memory candidate) — consolidation calls `embedPendingEntries`
 * after upserting candidates, and the standalone "rebuild embeddings" API
 * route calls it after re-flagging stale entries via
 * `MemoryEntryRepository.markPendingForRebuild`. Both paths converge on
 * this one batch loop (CLAUDE.md: "never duplicate logic").
 */

const BATCH_SIZE = 20;

export interface EmbeddingPipelineResult {
  embedded: number;
  failed: number;
  batchesProcessed: number;
}

/**
 * Processes every `pending` (or previously `failed`, if re-flagged pending
 * by a caller) memory entry for one org in batches of 20, writing vectors
 * via `MemoryEntryRepository.writeEmbedding`. A failed batch is retried
 * internally by the embedding client's own transient-failure retry
 * (network/5xx/429); if it still fails after that, every entry in the
 * batch is marked `embeddingStatus=failed` with the error recorded and the
 * loop continues to the next batch — matching the n8n spec's "partial
 * success is acceptable" contract exactly, rather than one bad batch
 * aborting the whole run.
 *
 * `orgId` is required (not nullable) deliberately — every real caller
 * (memory-consolidation-service.ts's per-org cron loop, the
 * rebuild-embeddings route) already operates within one org's request
 * context, and a hypothetical cross-org sweep would need its own explicit
 * RLS-aware justification rather than an easy-to-misuse optional
 * parameter. Fan-out across orgs happens one level up, in the caller's own
 * loop (see `/api/v1/cron/memory-consolidation`), not inside this
 * function.
 */
export async function embedPendingEntries(orgId: string, maxBatches = 25): Promise<EmbeddingPipelineResult> {
  const provider = getEmbeddingProvider();
  let embedded = 0;
  let failed = 0;
  let batchesProcessed = 0;

  for (let i = 0; i < maxBatches; i++) {
    const batch = await MemoryEntryRepository.listPendingEmbeddings(orgId, BATCH_SIZE);
    if (batch.length === 0) break;

    batchesProcessed += 1;

    try {
      const result = await provider.embed(batch.map((entry) => entry.content));
      await Promise.all(
        batch.map((entry, index) => {
          const vector = result.embeddings[index];
          if (!vector) {
            throw new EmbeddingApiError(`Missing embedding at index ${index} for a batch of ${batch.length}.`);
          }
          return MemoryEntryRepository.writeEmbedding(entry.id, vector, result.model, result.version);
        })
      );
      embedded += batch.length;
    } catch (error) {
      const message = error instanceof EmbeddingApiError ? error.message : String(error);
      // Per-entry failure write (not a single re-throw) so a bad batch
      // still leaves every entry inspectable/retryable individually
      // rather than stuck silently in `pending` forever.
      await Promise.all(batch.map((entry) => MemoryEntryRepository.markEmbeddingFailed(entry.id, message)));
      failed += batch.length;
    }

    // Fewer than a full batch means the queue is drained for this org.
    if (batch.length < BATCH_SIZE) break;
  }

  return { embedded, failed, batchesProcessed };
}
