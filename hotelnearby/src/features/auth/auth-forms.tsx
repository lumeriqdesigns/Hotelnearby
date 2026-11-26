"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxField, TextField } from "@/components/ui/form-fields";
import { EMPTY_AUTH_STATE } from "./types";
import {
  registerAction,
  requestPasswordResetAction,
  signInAction,
  updatePasswordAction,
  updateProfileAction,
} from "./actions";

function FormMessage({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return <p role={ok ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${ok ? "border-emerald-700/20 bg-emerald-50 text-emerald-900" : "border-red-500/30 bg-red-50 text-red-900"}`}>{message}</p>;
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, EMPTY_AUTH_STATE);
  return <form action={action} className="grid gap-5">
    <TextField label="Email address" name="email" type="email" autoComplete="email" required maxLength={254}/>
    <TextField label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128}/>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link className="font-semibold text-accent-text hover:underline" href="/forgot-password">Forgot password?</Link><Link className="font-semibold text-accent-text hover:underline" href="/register">Create an account</Link></div>
    <FormMessage {...state}/>
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in…" : "Sign in"}</Button>
  </form>;
}

export function RegisterForm({ defaultAccountType = "visitor" }: { defaultAccountType?: "visitor" | "provider_owner" }) {
  const [state, action, pending] = useActionState(registerAction, EMPTY_AUTH_STATE);
  return <form action={action} className="grid gap-5">
    <TextField label="Full name" name="fullName" autoComplete="name" required minLength={2} maxLength={120}/>
    <TextField label="Email address" name="email" type="email" autoComplete="email" required maxLength={254}/>
    <TextField label="Password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} hint="Use at least 10 characters. A password manager is recommended."/>
    <fieldset className="grid gap-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-bold">Account type</legend>
      <label className="flex items-start gap-3 text-sm"><input type="radio" name="accountType" value="visitor" defaultChecked={defaultAccountType === "visitor"} className="mt-1 size-4 accent-primary"/><span><strong>Visitor account</strong><span className="block text-muted-foreground">Save your details and manage your accommodation enquiries.</span></span></label>
      <label className="flex items-start gap-3 text-sm"><input type="radio" name="accountType" value="provider_owner" defaultChecked={defaultAccountType === "provider_owner"} className="mt-1 size-4 accent-primary"/><span><strong>Property provider</strong><span className="block text-muted-foreground">Register as an owner to manage your accommodation listings.</span></span></label>
    </fieldset>
    <TextField label="Business / organisation name" name="organisationName" maxLength={160} hint="Required when registering as a property provider."/>
    <CheckboxField label="I agree to the Hotelnearby Terms and Privacy Policy." name="termsAccepted" required/>
    <FormMessage {...state}/>
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating account…" : "Create account"}</Button>
    <p className="text-center text-sm text-muted-foreground">Already registered? <Link href="/sign-in" className="font-semibold text-accent-text hover:underline">Sign in</Link></p>
  </form>;
}

export function PasswordRecoveryForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, EMPTY_AUTH_STATE);
  return <form action={action} className="grid gap-5">
    <TextField label="Account email" name="email" type="email" autoComplete="email" required maxLength={254}/>
    <FormMessage {...state}/>
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send recovery link"}</Button>
  </form>;
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, EMPTY_AUTH_STATE);
  return <form action={action} className="grid gap-5">
    <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/>
    <TextField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/>
    <FormMessage {...state}/>
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Updating…" : "Update password"}</Button>
  </form>;
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string | null }) {
  const [state, action, pending] = useActionState(updateProfileAction, EMPTY_AUTH_STATE);
  return <form action={action} className="grid gap-5">
    <TextField label="Full name" name="fullName" defaultValue={fullName} required minLength={2} maxLength={120}/>
    <TextField label="Phone number" name="phone" type="tel" autoComplete="tel" defaultValue={phone ?? ""} maxLength={24}/>
    <FormMessage {...state}/>
    <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
  </form>;
}
