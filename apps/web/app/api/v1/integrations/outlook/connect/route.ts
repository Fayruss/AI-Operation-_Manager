import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api/errors";
import { generateOAuthState, oauthStateCookieName } from "@/lib/integrations/oauth-state";
import { buildOutlookAuthUrl } from "@/lib/integrations/outlook-oauth";

/** SAD §2.1/§7.8 Outlook connect flow — mirrors the Gmail connect route exactly. */
export async function GET(): Promise<NextResponse> {
  try {
    await getAuthContext();
  } catch (error) {
    return apiErrorResponse(error);
  }

  const state = generateOAuthState();
  const response = NextResponse.redirect(buildOutlookAuthUrl(state));
  response.cookies.set(oauthStateCookieName("outlook"), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600
  });
  return response;
}
