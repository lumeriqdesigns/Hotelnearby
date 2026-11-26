import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env/public";

/**
 * Supabase client for Server Components, server actions and route handlers.
 * It acts as the signed-in person (anon key plus their session cookies), so
 * Row Level Security is enforced. Create a new client per request.
 *
 * Because this reads cookies it is request-time data. Call it inside a
 * component wrapped in <Suspense>, never in a cached or static shell.
 */
export async function createSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Session refresh is handled
          // in the authentication stage (Prompt 9), so this is safe to ignore.
        }
      },
    },
  });
}
