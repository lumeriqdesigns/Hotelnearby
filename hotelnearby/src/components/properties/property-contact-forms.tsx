"use client";

import { useState, type FormEvent } from "react";

export function PropertyContactForms({ slug }: { slug: string }) {
  const [kind, setKind] = useState<"enquiry" | "report">("enquiry");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/property-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, slug, kind }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Please try again later.");
      setStatus("success");
      setMessage(kind === "enquiry" ? "Your enquiry has been recorded. Contact the property directly as well if you need a faster response." : "Thank you. Your listing report has been submitted for review.");
      formElement.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not submit this form. Please try again.");
    }
  }

  return (
    <section id="contact-property" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-h3 font-extrabold">Contact this property</h2>
      <p className="mt-2 text-sm text-muted-foreground">Send a question directly through Hotelnearby. Do not send payment or sensitive financial information in this form.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Contact form type">
        <button type="button" onClick={() => { setKind("enquiry"); setStatus("idle"); setMessage(""); }} aria-pressed={kind === "enquiry"} className={`rounded-full px-4 py-2 text-sm font-bold ${kind === "enquiry" ? "bg-primary text-primary-foreground" : "border border-border"}`}>Send an enquiry</button>
        <button type="button" onClick={() => { setKind("report"); setStatus("idle"); setMessage(""); }} aria-pressed={kind === "report"} className={`rounded-full px-4 py-2 text-sm font-bold ${kind === "report" ? "bg-primary text-primary-foreground" : "border border-border"}`}>Report this listing</button>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Your name<input required name="name" minLength={2} maxLength={120} autoComplete="name" className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal" /></label>
        {kind === "enquiry" ? (
          <>
            <label className="grid gap-1 text-sm font-semibold">Phone or email<input required name="contact" minLength={5} maxLength={180} autoComplete="email" className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Your question<textarea required name="message" minLength={10} maxLength={3000} rows={4} placeholder="Ask about room types, facilities, location or current rates…" className="rounded-lg border border-input-border bg-background px-3 py-2 font-normal" /></label>
          </>
        ) : (
          <>
            <label className="grid gap-1 text-sm font-semibold">Reason for report<select name="reason" required className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal"><option value="">Select a reason</option><option value="incorrect-information">Incorrect information</option><option value="unavailable-property">Property appears unavailable</option><option value="suspected-fraud">Suspected fraud</option><option value="inappropriate-content">Inappropriate content</option><option value="other">Other</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Additional details<textarea name="details" maxLength={2000} rows={3} className="rounded-lg border border-input-border bg-background px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Your contact (optional)<input name="contact" maxLength={180} className="min-h-11 rounded-lg border border-input-border bg-background px-3 font-normal" /></label>
          </>
        )}
        {message ? <p role={status === "error" ? "alert" : "status"} className={`text-sm ${status === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p> : null}
        <button type="submit" disabled={status === "sending"} className="min-h-12 rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">{status === "sending" ? "Submitting…" : kind === "enquiry" ? "Send enquiry" : "Submit report"}</button>
      </form>
    </section>
  );
}
