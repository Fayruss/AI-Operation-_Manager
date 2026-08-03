/**
 * Next.js 15 instrumentation hook — runs once when the server starts, before
 * any request is handled. Used here purely for fail-fast environment
 * validation (lib/env.ts); no tracing/APM wiring in this phase.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/env");
    getEnv();
  }
}
