import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";

/**
 * Service-role Supabase client. This BYPASSES Row Level Security.
 *
 * Use it only for trusted server work that has no signed-in person behind it
 * or that must act across accounts: payment webhooks, scheduled jobs, and
 * audited admin operations. Authorise the caller yourself before using it.
 * ESLint blocks importing it from UI components.
 */
export function createSupabaseAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const { supabaseServiceRoleKey } = getServerEnv();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase admin access is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
