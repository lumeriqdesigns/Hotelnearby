"use client";
import { useState } from "react";

const field = "w-full rounded-xl border border-input-border bg-background px-3 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function SupportRequestForm() {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [ok,setOk]=useState(false);
  async function submit(formData: FormData) {
    setBusy(true); setMessage(""); setOk(false);
    const payload=Object.fromEntries(formData.entries());
    try { const response=await fetch("/api/support/request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}); const result=await response.json(); if(!response.ok) throw new Error(result.message||"Unable to submit request."); setOk(true); setMessage("Your support request has been received. Our team will review it and follow up using the contact details you provided."); (document.getElementById("support-request") as HTMLFormElement | null)?.reset(); }
    catch(error){setMessage(error instanceof Error?error.message:"Unable to submit request. Please try again.");} finally{setBusy(false);}
  }
  return <form id="support-request" action={submit} className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
    <div className="grid gap-1"><label className="text-sm font-bold" htmlFor="support-kind">How can we help?</label><select id="support-kind" name="kind" required className={field}><option value="visitor_support">Visitor support</option><option value="provider_support">Provider support</option><option value="advertising">Advertising enquiry</option><option value="partnership">Partnership enquiry</option><option value="listing_report">Report a listing</option><option value="technical">Technical issue</option><option value="other">Other</option></select></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1"><label htmlFor="support-name" className="text-sm font-bold">Your name</label><input id="support-name" name="name" required minLength={2} maxLength={100} autoComplete="name" className={field}/></div><div className="grid gap-1"><label htmlFor="support-email" className="text-sm font-bold">Email address</label><input id="support-email" name="email" type="email" required maxLength={180} autoComplete="email" className={field}/></div></div>
    <div className="grid gap-1"><label htmlFor="support-contact" className="text-sm font-bold">Phone / WhatsApp (optional)</label><input id="support-contact" name="contact" maxLength={40} autoComplete="tel" className={field}/></div>
    <div className="grid gap-1"><label htmlFor="support-subject" className="text-sm font-bold">Subject</label><input id="support-subject" name="subject" required minLength={4} maxLength={160} className={field}/></div>
    <div className="grid gap-1"><label htmlFor="support-message" className="text-sm font-bold">Message</label><textarea id="support-message" name="message" required minLength={15} maxLength={4000} rows={5} className={field} placeholder="Tell us what happened or what you would like to discuss."/></div>
    <div className="hidden" aria-hidden="true"><label htmlFor="support-website">Website</label><input id="support-website" name="website" tabIndex={-1} autoComplete="off"/></div>
    <p className="text-xs leading-5 text-muted-foreground">Please do not include passwords, payment card details, identity documents or other sensitive information. Hotelnearby does not take accommodation bookings or guest payments.</p>
    <button disabled={busy} className="min-h-12 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{busy?"Submitting…":"Send support request"}</button>
    {message?<p role="status" aria-live="polite" className={`text-sm ${ok?"text-success-fg":"text-danger-fg"}`}>{message}</p>:null}
  </form>;
}
