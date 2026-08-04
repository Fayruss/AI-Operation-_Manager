import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** The cookie batch `setAll` receives — `createServerClient` accepts a union of cookie-method shapes, so this parameter isn't contextually typed. */
type CookiesToSet = Parameters<SetAllCookies>[0];

/**
 * SAD §6.5: "middleware.ts checks session on every /app/* route, redirects
 * to /login if absent". Also refreshes the Supabase session cookie so
 * Server Components always see a valid token (per @supabase/ssr guidance).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAppRoute = request.nextUrl.pathname.startsWith("/app");
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/signup");

  if (!user && isAppRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  return response;
}
