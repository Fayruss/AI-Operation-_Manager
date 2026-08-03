import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Standard cookie-based OAuth `state` CSRF protection: a random nonce is
 * set as an httpOnly cookie on the connect redirect and compared against
 * the `state` query param the provider echoes back on callback. The actual
 * user/org context is re-resolved from the (still-present) Supabase session
 * cookie in the callback handler — `state` here only proves "this callback
 * corresponds to a redirect this browser initiated," nothing more.
 */
export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function oauthStateCookieName(provider: "gmail" | "outlook"): string {
  return `oauth_state_${provider}`;
}
