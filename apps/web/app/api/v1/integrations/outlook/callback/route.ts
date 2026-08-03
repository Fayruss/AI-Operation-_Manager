import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { oauthStateCookieName } from "@/lib/integrations/oauth-state";
import { exchangeOutlookCode } from "@/lib/integrations/outlook-oauth";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";

/** Microsoft redirects here with `code`/`state` after the user grants consent. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const settingsUrl = `${appUrl}/app/settings?tab=integrations`;

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(oauthStateCookieName("outlook"))?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${settingsUrl}&error=invalid_oauth_state`);
  }

  try {
    const ctx = await getAuthContext();
    const tokens = await exchangeOutlookCode(code);
    await EmailAccountRepository.connect(ctx.orgId, ctx.userId, "outlook", tokens);
  } catch (error) {
    console.error("[outlook oauth callback]", error);
    return NextResponse.redirect(`${settingsUrl}&error=connect_failed`);
  }

  const response = NextResponse.redirect(`${settingsUrl}&connected=outlook`);
  response.cookies.delete(oauthStateCookieName("outlook"));
  return response;
}
