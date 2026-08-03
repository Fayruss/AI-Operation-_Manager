import "server-only";
import { prisma } from "@ai-ops/database";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import type { UserRole } from "@ai-ops/types";

/**
 * The resolved identity + tenant context for a request — every API route
 * and Server Action in this phase reads this instead of touching Supabase
 * or Prisma's `users` table directly (CLAUDE.md: "never duplicate logic").
 */
export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  email: string;
  name: string;
}

/**
 * Strict resolver for API routes / Server Actions — throws UNAUTHENTICATED
 * rather than falling back to demo data, unlike the UI convenience wrapper
 * in lib/auth/get-current-user.ts. This is the boundary that actually gates
 * write access, so it must never silently substitute a fake identity.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError("UNAUTHENTICATED", "You must be signed in to perform this action.");
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, orgId: true, role: true, email: true, name: true }
  });

  if (!profile) {
    // Auth user exists but the public.users row hasn't been provisioned yet
    // (e.g. the 002_auth_trigger.sql trigger hasn't run against this
    // Supabase project). Treat as unauthenticated rather than guessing at
    // an org — there is no tenant to scope this request to.
    throw new ApiError("UNAUTHENTICATED", "Your account isn't fully provisioned yet.");
  }

  return {
    userId: profile.id,
    orgId: profile.orgId,
    role: profile.role,
    email: profile.email,
    name: profile.name
  };
}
