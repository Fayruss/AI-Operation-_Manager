import "server-only";
import type { NormalizedEmail, OAuthTokens } from "@/lib/integrations/gmail-oauth";

/**
 * SAD §2.1 Microsoft Outlook OAuth connect flow, via the Microsoft identity
 * platform v2.0 endpoint + Microsoft Graph — same "direct fetch, no SDK"
 * pattern as gmail-oauth.ts. Scope: `Mail.Read` (readonly is sufficient for
 * ingestion; `Mail.Send` would be needed for the Reply-Draft Agent, out of
 * scope this phase).
 */
const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

const SCOPES = ["offline_access", "openid", "email", "Mail.Read"].join(" ");

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/v1/integrations/outlook/callback`;
}

export function buildOutlookAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID is not set (see .env.example)");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    response_mode: "query",
    scope: SCOPES,
    state
  });

  return `${MS_AUTH_URL}?${params.toString()}`;
}

export async function exchangeOutlookCode(code: string): Promise<OAuthTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth client credentials are not set (see .env.example)");
  }

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
      scope: SCOPES
    })
  });

  if (!response.ok) {
    throw new Error(`Outlook token exchange failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  };
}

export async function refreshOutlookAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth client credentials are not set (see .env.example)");
  }

  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: SCOPES
    })
  });

  if (!response.ok) {
    throw new Error(`Outlook token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, refreshToken, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

export async function fetchOutlookMessage(accessToken: string, messageId: string): Promise<NormalizedEmail> {
  const response = await fetch(`${GRAPH_API_BASE}/me/messages/${messageId}?$select=conversationId,from,subject,bodyPreview,receivedDateTime`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Outlook message fetch failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    conversationId: string;
    from?: { emailAddress?: { address?: string; name?: string } };
    subject?: string;
    bodyPreview?: string;
    receivedDateTime: string;
  };

  return {
    threadId: data.conversationId,
    sender: data.from?.emailAddress?.address ?? "unknown",
    subject: data.subject ?? "(no subject)",
    bodySnippet: data.bodyPreview ?? "",
    receivedAt: new Date(data.receivedDateTime)
  };
}
