import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { oauthStateCookieName } from "@/lib/integrations/oauth-state";
import { exchangeGmailCode } from "@/lib/integrations/gmail-oauth";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";

/** Google redirects here with `code`/`state` after the user grants consent. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const settingsUrl = `${appUrl}/app/settings?tab=integrations`;

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(oauthStateCookieName("gmail"))?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${settingsUrl}&error=invalid_oauth_state`);
  }

  try {
    const ctx = await getAuthContext();
    const tokens = await exchangeGmailCode(code);
    await EmailAccountRepository.connect(ctx.orgId, ctx.userId, "gmail", tokens);
  } catch (error) {
    console.error("[gmail oauth callback]", error);
    return NextResponse.redirect(`${settingsUrl}&error=connect_failed`);
  }

  const response = NextResponse.redirect(`${settingsUrl}&connected=gmail`);
  response.cookies.delete(oauthStateCookieName("gmail"));
  return response;
}
