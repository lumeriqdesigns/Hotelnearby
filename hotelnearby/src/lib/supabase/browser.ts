import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env/public";

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Supabase client for Client Components. Uses only the public anon key, so it
 * can read and write exactly what Row Level Security allows for the signed-in
 * person, and nothing more.
 */
export function getSupabaseBrowserClient() {
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
