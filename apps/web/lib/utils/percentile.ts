/**
 * Nearest-rank percentile over a pre-sorted ascending array.
 *
 * SAD §15 AI Control Center: "API latency (p50/p95) — computed from
 * `agent_runs.started_at`/`completed_at`". Kept as a standalone pure
 * function (same rationale as lib/risk/severity.ts) so the percentile math
 * is unit-testable without a database.
 */
export function percentile(sortedValues: number[], fraction: number): number | null {
  if (sortedValues.length === 0) return null;

  const rank = Math.ceil(fraction * sortedValues.length);
  // Guard both ends: fraction <= 0 would give rank 0, fraction 1 gives
  // exactly length — both need to land on a real index.
  const index = Math.min(Math.max(rank - 1, 0), sortedValues.length - 1);
  return sortedValues[index] ?? null;
}
