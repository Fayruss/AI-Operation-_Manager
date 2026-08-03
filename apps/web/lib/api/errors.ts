import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * API Contract doc — Global Conventions: every non-2xx response uses this
 * exact envelope shape. Error codes match the per-endpoint tables in the
 * API Contract (VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND,
 * ALREADY_DECIDED, RATE_LIMITED, INTERNAL_ERROR).
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ALREADY_DECIDED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_DECIDED: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  /**
   * `category` drives the HTTP status; `codeOverride` lets call sites emit
   * the exact resource-specific code the API Contract documents (e.g.
   * `BOARD_NOT_FOUND`, `ALREADY_DECIDED`) while still using the shared
   * status-mapping table below.
   */
  constructor(category: ApiErrorCode, message: string, details?: Record<string, unknown>, codeOverride?: string) {
    super(message);
    this.code = codeOverride ?? category;
    this.status = STATUS_BY_CODE[category];
    this.details = details;
    this.name = "ApiError";
  }
}

/**
 * SAD §5 "Error handling standard": 4xx = client/validation, 401/403 split
 * explicitly, 404 used for cross-tenant resource access (never leak
 * existence via 403), 5xx logged (Sentry wiring is Phase 6 — this phase
 * logs via console.error with enough context to correlate later).
 */
export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details ?? {} } },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR" satisfies ApiErrorCode,
          message: firstIssue?.message ?? "Invalid request body",
          details: { field: firstIssue?.path.join(".") ?? undefined, issues: error.issues }
        }
      },
      { status: 400 }
    );
  }

  // Unknown/unexpected error — never leak internals to the client (CLAUDE.md:
  // "Never expose internal errors to the client").
  console.error("[api] unhandled error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR" satisfies ApiErrorCode, message: "Something went wrong", details: {} } },
    { status: 500 }
  );
}

/**
 * Wraps a Route Handler so every endpoint gets identical try/catch →
 * standardized error envelope behavior without repeating it per-route
 * (CLAUDE.md: "never duplicate logic").
 */
export function withApiHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}
