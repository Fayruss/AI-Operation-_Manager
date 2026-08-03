import "server-only";

/**
 * SAD §2.1 Gmail OAuth connect flow. Uses Google's OAuth 2.0 endpoints
 * directly via fetch — no SDK dependency, matching the rest of this
 * project's "thin server-side service module" pattern.
 * Scope: `gmail.readonly` is sufficient for the ingestion pipeline (SAD's
 * Reply-Draft Agent, §9.5, would need `gmail.send` too, but that's Phase 3.5+
 * — reply-draft approval isn't in this phase's scope).
 */
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "openid", "email"].join(" ");

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/v1/integrations/gmail/callback`;
}

export function buildGmailAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set (see .env.example)");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCode(code: string): Promise<OAuthTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are not set (see .env.example)");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(`Gmail token exchange failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  };
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are not set (see .env.example)");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(`Gmail token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, refreshToken, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

/**
 * Gmail's real push-notification payload only carries `{emailAddress,
 * historyId}` — resolving that into actual new message IDs requires walking
 * `users.history.list`, which is beyond this foundation phase's scope.
 * Simplification: on webhook trigger, fetch the single most recent message
 * instead. Documented here rather than silently assumed.
 */
export async function fetchLatestGmailMessageId(accessToken: string): Promise<string | null> {
  const response = await fetch(`${GMAIL_API_BASE}/users/me/messages?maxResults=1`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Gmail message list failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? null;
}

export interface NormalizedEmail {
  threadId: string;
  sender: string;
  subject: string;
  bodySnippet: string;
  receivedAt: Date;
}

/** n8n Workflow Spec §1 node 2 equivalent: "fetch full message body from Gmail API using stored OAuth token." */
export async function fetchGmailMessage(accessToken: string, messageId: string): Promise<NormalizedEmail> {
  const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/${messageId}?format=metadata`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Gmail message fetch failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    threadId: string;
    snippet: string;
    internalDate: string;
    payload?: { headers?: { name: string; value: string }[] };
  };

  const headers = data.payload?.headers ?? [];
  const getHeader = (name: string): string =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  return {
    threadId: data.threadId,
    sender: getHeader("From") || "unknown",
    subject: getHeader("Subject") || "(no subject)",
    bodySnippet: data.snippet,
    receivedAt: new Date(Number(data.internalDate))
  };
}
