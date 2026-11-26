import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlatformRole } from "./types";

export async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  // getUser validates the session with Supabase Auth; never trust cookie-only getSession().
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,phone,avatar_url,role,email_verified_at,account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.account_status === "suspended") return null;
  return { supabase, user, profile: profile as {
    id: string;
    email: string | null;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    role: PlatformRole;
    email_verified_at: string | null;
    account_status: "active" | "suspended";
  } };
}

export async function requireAuthenticatedUser(redirectTo = "/sign-in") {
  const context = await getAuthenticatedContext();
  if (!context) redirect(redirectTo);
  return context;
}

export async function requirePlatformRoles(roles: PlatformRole[], redirectTo = "/account/profile") {
  const context = await requireAuthenticatedUser();
  if (!roles.includes(context.profile.role)) redirect(redirectTo);
  return context;
}
