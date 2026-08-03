import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api/errors";
import { generateOAuthState, oauthStateCookieName } from "@/lib/integrations/oauth-state";
import { buildGmailAuthUrl } from "@/lib/integrations/gmail-oauth";

/**
 * SAD §2.1/§7.8 "Integrations (Gmail/Outlook/Slack/Zoom connect flows)".
 * Redirect-based connect: requires an authenticated session (the user
 * initiating the connect), sets a CSRF nonce cookie, redirects to Google.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getAuthContext(); // ensures only signed-in users can start a connect flow
  } catch (error) {
    return apiErrorResponse(error);
  }

  const state = generateOAuthState();
  const response = NextResponse.redirect(buildGmailAuthUrl(state));
  response.cookies.set(oauthStateCookieName("gmail"), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600
  });
  return response;
}
