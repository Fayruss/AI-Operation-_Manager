import "server-only";
import { getAuthContext } from "@/lib/auth/session";
import { mockCurrentUser } from "@/lib/mock/mock-data";
import type { AppUser } from "@ai-ops/types";

/**
 * Resolves the authenticated user for Server Components (SAD §6.5). This is
 * the UI-convenience wrapper around lib/auth/session.ts's strict resolver:
 * it falls back to the Phase-1 demo fixture when Supabase isn't configured
 * or the session can't be resolved, so the shell stays reviewable without a
 * live project — middleware.ts still enforces the real redirect-to-/login
 * guard, and API routes use getAuthContext() directly (no fallback there).
 */
export async function getCurrentUser(): Promise<AppUser> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return mockCurrentUser;
  }

  try {
    const ctx = await getAuthContext();
    return { id: ctx.userId, orgId: ctx.orgId, email: ctx.email, name: ctx.name, role: ctx.role, avatarUrl: null };
  } catch {
    return mockCurrentUser;
  }
}
