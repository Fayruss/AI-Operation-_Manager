import "server-only";

/**
 * API Contract Global Conventions: "all POST endpoints that create resources
 * accept an optional Idempotency-Key header; duplicate keys within 24h
 * return the original response rather than creating a duplicate."
 *
 * PRODUCTION NOTE: this is an in-memory, single-process store — correct for
 * local dev and demonstrating the contract, but it will not survive a
 * restart or work across multiple server instances. A production deploy
 * (SAD §3: Vercel, multi-instance) needs this backed by Redis/Upstash or a
 * dedicated Postgres table with a TTL sweep; swap the implementation below
 * without touching any call site.
 */
interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const store = new Map<string, CachedResponse>();

function key(orgId: string, idempotencyKey: string): string {
  return `${orgId}:${idempotencyKey}`;
}

export function getIdempotentResponse(orgId: string, idempotencyKey: string | null): CachedResponse | null {
  if (!idempotencyKey) return null;
  const entry = store.get(key(orgId, idempotencyKey));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key(orgId, idempotencyKey));
    return null;
  }
  return entry;
}

export function saveIdempotentResponse(
  orgId: string,
  idempotencyKey: string | null,
  status: number,
  body: unknown
): void {
  if (!idempotencyKey) return;
  store.set(key(orgId, idempotencyKey), { status, body, expiresAt: Date.now() + TTL_MS });
}
