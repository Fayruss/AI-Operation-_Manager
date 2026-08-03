"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (SAD §6.5: "Supabase client session via React
 * Context, hydrated server-side in root layout"). Never import this into a
 * Server Component — use lib/supabase/server.ts there.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}
