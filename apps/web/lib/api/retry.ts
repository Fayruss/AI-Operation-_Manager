import "server-only";

/**
 * Generic exponential-backoff retry, matching the cadence documented
 * throughout the n8n Workflow Spec for external API calls: "3 attempts,
 * exponential backoff (2s/8s/32s)" (§1 node 4, §3 Summarizer, reused here
 * as the shared implementation rather than duplicated per call site).
 */
export interface RetryOptions {
  attempts?: number;
  /** Backoff delays in ms, one per retry (not counting the first attempt). Defaults to the n8n spec's 2s/8s/32s. */
  backoffMs?: number[];
  /** Only retry errors this predicate accepts (e.g. network/5xx, not 4xx validation failures). Defaults to "retry everything." */
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_BACKOFF_MS = [2000, 8000, 32000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const attempts = options.attempts ?? backoff.length + 1;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts - 1;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }
      await sleep(backoff[Math.min(attempt, backoff.length - 1)] ?? 2000);
    }
  }
  // Unreachable (loop always returns or throws), but keeps TS happy about a guaranteed return/throw.
  throw lastError;
}
