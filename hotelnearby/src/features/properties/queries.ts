import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import type { PublicPropertyDetail } from "./types";

export async function getPublicPropertyDetail(slug: string): Promise<PublicPropertyDetail | null> {
  try {
    const env = getPublicEnv();
    if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("get_public_property_detail", { p_slug: slug });
    if (error || !data || typeof data !== "object") return null;
    return data as PublicPropertyDetail;
  } catch {
    return null;
  }
}
