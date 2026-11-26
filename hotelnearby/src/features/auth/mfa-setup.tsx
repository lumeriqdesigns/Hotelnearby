"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Factor = { id: string; factor_type: string; status: string; friendly_name?: string };

export function MfaSetup({ initialFactors }: { initialFactors: Factor[] }) {
  const [factors, setFactors] = useState(initialFactors);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function startEnrollment() {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "Hotelnearby authenticator" });
      if (error) throw error;
      setFactorId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret);
      setMessage("Scan the QR code with an authenticator app, then enter its six-digit code.");
    } catch { setMessage("MFA setup could not start. Please sign in again and retry."); }
    finally { setBusy(false); }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
      if (error) throw error;
      const { data } = await supabase.auth.mfa.listFactors();
      setFactors(data?.totp ?? []); setFactorId(null); setQrCode(null); setSecret(null); setCode("");
      setMessage("Two-step verification is now enabled for this account.");
    } catch { setMessage("That code could not be verified. Check your authenticator and try again."); }
    finally { setBusy(false); }
  }

  async function removeFactor(id: string) {
    setBusy(true); setMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      const { data } = await getSupabaseBrowserClient().auth.mfa.listFactors();
      setFactors(data?.totp ?? []); setMessage("Authenticator removed.");
    } catch { setMessage("The authenticator could not be removed. Verify your session and try again."); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-5">
    <div className="grid gap-3">{factors.filter((factor) => factor.status === "verified").map((factor) => <div key={factor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="font-bold">Authenticator app</p><p className="text-xs text-muted-foreground">Verified two-step factor</p></div><Button type="button" variant="secondary" disabled={busy} onClick={() => removeFactor(factor.id)}>Remove</Button></div>)}</div>
    {!factorId && factors.every((factor) => factor.status !== "verified") ? <Button type="button" onClick={startEnrollment} disabled={busy}>{busy ? "Preparing…" : "Set up authenticator app"}</Button> : null}
    {factorId && qrCode ? <form onSubmit={verifyEnrollment} className="grid gap-4 rounded-xl border border-border p-4">
      <p className="text-sm">Scan this QR code using an authenticator app such as 1Password, Google Authenticator or Microsoft Authenticator.</p>
      {/* Supabase returns this QR as a data URI for the signed-in user. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={qrCode} alt="Authenticator setup QR code" className="mx-auto size-48 rounded-lg border border-border bg-white p-2"/>
      {secret ? <details><summary className="cursor-pointer text-sm font-semibold">Can't scan? Show setup key</summary><code className="mt-2 block break-all rounded bg-surface-muted p-3 text-xs">{secret}</code></details> : null}
      <label className="grid gap-1 text-sm font-semibold">Six-digit verification code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="min-h-11 rounded-md border border-input-border bg-surface px-3 text-base tracking-[0.3em]"/></label>
      <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and enable MFA"}</Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => { setFactorId(null); setQrCode(null); setSecret(null); }}>Cancel setup</Button>
    </form> : null}
    {message ? <p role="status" className="rounded-lg border border-border bg-surface-muted p-3 text-sm">{message}</p> : null}
  </div>;
}
