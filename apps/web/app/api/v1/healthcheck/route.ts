import { NextResponse } from "next/server";

/**
 * API Contract doc: base URL `/api/v1`. This route isn't part of the
 * documented endpoint set — it exists purely as a CI/Docker smoke-test
 * target (Implementation Guide Phase 0 Definition of Done) and returns no
 * tenant data, so it intentionally skips auth.
 */
export function GET(): NextResponse {
  return NextResponse.json({ status: "ok", phase: "1-foundation", timestamp: new Date().toISOString() });
}
