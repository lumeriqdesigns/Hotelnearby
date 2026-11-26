"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getPublicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthFormState } from "./types";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(10).max(128);
const nameSchema = z.string().trim().min(2).max(120);
const siteUrl = () => getPublicEnv().siteUrl;
const messageFromAuthError = (message: string) => {
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Please verify your email address before signing in.";
  if (/already registered|already been registered/i.test(message)) return "An account with this email already exists. Try signing in instead.";
  return "We could not complete that request. Check your details and try again.";
};

export async function signInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse({
    email: formData.get("email"), password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid email address and password." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, message: error ? messageFromAuthError(error.message) : "Sign in could not be completed." };
  const { data: profile } = await supabase.from("profiles").select("role,account_status").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.account_status !== "active") {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, message: "This account is unavailable. Please contact support." };
  }
  if (["administrator", "editor_moderator"].includes(profile.role)) redirect("/admin");
  if (["provider_owner", "provider_staff"].includes(profile.role)) redirect("/dashboard");
  redirect("/account/profile");
}

export async function adminSignInAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse({
    email: formData.get("email"), password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid work email and password." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, message: error ? messageFromAuthError(error.message) : "Sign in could not be completed." };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role,account_status").eq("id", data.user.id).maybeSingle();
  if (profileError || !profile || profile.account_status !== "active" || !["administrator", "editor_moderator"].includes(profile.role)) {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, message: "This account does not have administrator access. Use the provider or visitor sign-in instead." };
  }
  redirect("/admin");
}

export async function registerAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    fullName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    accountType: z.enum(["visitor", "provider_owner"]),
    organisationName: z.string().trim().max(160).optional(),
    termsAccepted: z.literal("on"),
  }).safeParse({
    fullName: formData.get("fullName"), email: formData.get("email"),
    password: formData.get("password"), accountType: formData.get("accountType"),
    organisationName: formData.get("organisationName") || undefined,
    termsAccepted: formData.get("termsAccepted"),
  });
  if (!parsed.success) return { ok: false, message: "Check your name, email, password and account type. Passwords must be at least 10 characters." };
  if (parsed.data.accountType === "provider_owner" && (!parsed.data.organisationName || parsed.data.organisationName.length < 2)) {
    return { ok: false, message: "Enter your property business or organisation name." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      data: {
        full_name: parsed.data.fullName,
        // The database trigger independently allow-lists public signup roles.
        account_type: parsed.data.accountType,
        organisation_name: parsed.data.accountType === "provider_owner" ? parsed.data.organisationName : null,
      },
    },
  });
  if (error) return { ok: false, message: "We could not create this account. Check the details or try signing in if you already registered." };
  if (data.session) redirect("/account/profile");
  return { ok: true, message: "Account created. Check your email for the verification link before signing in." };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function signOutEverywhereAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/");
}

export async function requestPasswordResetAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/confirm`,
  });
  if (error) return { ok: false, message: "We could not send a recovery email right now. Please try again later." };
  // Same response for known and unknown email addresses to reduce account enumeration.
  return { ok: true, message: "If an account exists for that email, a password recovery link has been sent." };
}

export async function updatePasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ password: passwordSchema, confirmPassword: z.string() }).safeParse({
    password: formData.get("password"), confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    return { ok: false, message: "Enter a password of at least 10 characters and make sure both entries match." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Your recovery session has expired. Request a new password reset link." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "Password could not be updated. Request a new recovery link and try again." };
  redirect("/account/profile?password=updated");
}

export async function updateProfileAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    fullName: nameSchema,
    phone: z.string().trim().max(24).optional(),
  }).safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") || undefined });
  if (!parsed.success) return { ok: false, message: "Enter a name of at least two characters and a valid phone field." };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Please sign in again to update your profile." };
  const { error: authError } = await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });
  if (authError) return { ok: false, message: "Your profile could not be updated. Please try again." };
  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
  }).eq("id", user.id);
  if (error) return { ok: false, message: "Your profile could not be saved. Confirm the Prompt 9 database migration is applied." };
  return { ok: true, message: "Your profile has been updated." };
}
