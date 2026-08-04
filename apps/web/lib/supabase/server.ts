import { createServerClient } from "@supabase/ssr";
import type { CookieOptions, SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

/** The cookie batch `setAll` receives — `createServerClient` accepts a union of cookie-method shapes, so this parameter isn't contextually typed. */
type CookiesToSet = Parameters<SetAllCookies>[0];

/**
 * Server-side Supabase client for Server Components/Route Handlers/Server
 * Actions. CLAUDE.md: "Never fetch sensitive data inside Client Components" —
 * this is the sanctioned path for reading the authenticated session server-side.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to mutate —
            // safe to ignore because middleware.ts refreshes the session on every request.
          }
        }
      }
    }
  );
}
