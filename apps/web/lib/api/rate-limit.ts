import "server-only";
import { ApiError } from "@/lib/api/errors";

/**
 * API Contract Global Conventions: "100 req/min per user for write
 * endpoints." Simple fixed-window counter, in-memory.
 *
 * PRODUCTION NOTE: same caveat as idempotency.ts — this only limits within a
 * single server process/instance. Multi-instance deploys need a shared store
 * (Upstash Redis is the common Vercel-native choice). The function signature
 * below is intentionally the seam to swap that in later without touching callers.
 */
interface Window {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60 * 1000;
const buckets = new Map<string, Window>();

/**
 * @param windowMs Defaults to the API Contract's "100 req/min" cadence.
 * Callers with a different documented limit (e.g. API Contract Pattern B:
 * "max 5 manual generations/hour/org") pass their own window instead of a
 * second rate-limiting implementation.
 */
export function checkRateLimit(key: string, limit = 100, windowMs: number = DEFAULT_WINDOW_MS): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new ApiError("RATE_LIMITED", "Too many requests — please slow down.", {
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
    });
  }

  bucket.count += 1;
}
