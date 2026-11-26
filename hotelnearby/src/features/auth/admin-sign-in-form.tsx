"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-fields";
import { adminSignInAction } from "./actions";
import { EMPTY_AUTH_STATE } from "./types";

export function AdminSignInForm() {
  const [state, action, pending] = useActionState(adminSignInAction, EMPTY_AUTH_STATE);
  return <form action={action} className="grid gap-5">
    <TextField label="Work email" name="email" type="email" autoComplete="username" required maxLength={254} />
    <TextField label="Password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
    {state.message ? <p role={state.ok ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${state.ok ? "border-emerald-700/20 bg-emerald-50 text-emerald-900" : "border-red-500/30 bg-red-50 text-red-900"}`}>{state.message}</p> : null}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Verifying access…" : "Sign in to admin"}</Button>
    <Link href="/forgot-password" className="text-center text-sm font-semibold text-accent-text hover:underline">Forgot your password?</Link>
  </form>;
}
