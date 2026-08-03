import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/errors";
import { getAuthContext, type AuthContext } from "@/lib/auth/session";
import { requireMinRole } from "@/lib/auth/rbac";
import { checkRateLimit } from "@/lib/api/rate-limit";
import type { UserRole } from "@ai-ops/types";

export type RouteParams<P extends Record<string, string> = Record<string, never>> = { params: Promise<P> };

export interface ApiRouteOptions {
  /** SAD §5's per-endpoint "Auth" column — enforced before the handler runs. */
  minRole?: UserRole;
  /** API Contract Global Conventions: "100 req/min per user for write endpoints." Skipped for GET by default. */
  rateLimit?: boolean;
}

/**
 * Standard composition for every `/api/v1/*` route: try/catch → error
 * envelope (lib/api/errors.ts), auth resolution, RBAC, rate limiting.
 * CLAUDE.md: "never duplicate logic" — this is the one place that logic lives.
 */
export function apiRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (request: NextRequest, ctx: AuthContext, params: P) => Promise<NextResponse>,
  options: ApiRouteOptions = {}
) {
  return withApiHandler(async (request: NextRequest, routeContext: RouteParams<P>) => {
    const ctx = await getAuthContext();

    if (options.minRole) {
      requireMinRole(ctx.role, options.minRole);
    }

    if (options.rateLimit !== false && request.method !== "GET") {
      checkRateLimit(`${ctx.userId}:write`);
    }

    const params = await routeContext.params;
    return handler(request, ctx, params);
  });
}
