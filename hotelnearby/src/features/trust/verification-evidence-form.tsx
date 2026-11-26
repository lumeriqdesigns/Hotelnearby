"use client";
import { useState } from "react";
import { submitVerificationAction } from "@/features/trust/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PropertyOption = { id: string; name: string; verification_status: string };
const inputClass = "min-h-10 rounded-lg border border-input-border bg-background px-3 text-sm";
export function VerificationEvidenceForm({ properties }: { properties: PropertyOption[] }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [objectPath, setObjectPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(file?: File) {
    if (!file || !propertyId) return;
    if (file.size > 10 * 1024 * 1024) { setMessage("File must be 10 MB or smaller."); return; }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Upload a PDF, JPG, PNG or WebP file."); return; }
    setUploading(true); setMessage(""); setObjectPath("");
    try {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100) || "evidence.pdf";
      const path = `${propertyId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await getSupabaseBrowserClient().storage.from("property-verification").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setObjectPath(path); setMessage("Evidence uploaded to private storage. Submit the form to create the review record.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed. Please try again."); }
    finally { setUploading(false); }
  }
  return <form action={submitVerificationAction} className="mt-4 grid gap-3 md:grid-cols-2">
    <label className="grid gap-1 text-sm font-semibold">Property<select name="propertyId" required value={propertyId} onChange={e=>{setPropertyId(e.target.value);setObjectPath("");setMessage("");}} className={inputClass}>{properties.map(p=><option key={p.id} value={p.id}>{p.name} · {p.verification_status}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-semibold">Evidence type<select name="verificationType" className={inputClass}>{[["identity","Provider identity"],["business_registration","Business registration"],["ownership","Property ownership / authority"],["site_visit","Site visit"],["licence","Operating licence"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-semibold md:col-span-2">Upload evidence (PDF, JPG, PNG or WebP)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading || !propertyId} onChange={e=>void upload(e.target.files?.[0])} className="min-h-11 rounded-lg border border-input-border bg-background p-2 text-sm"/><span className="text-xs font-normal text-muted-foreground">Maximum 10 MB. Files are private and accessible only to your property team and authorised verification reviewers.</span></label>
    <input type="hidden" name="evidenceUrl" value={objectPath}/>
    {objectPath ? <p className="md:col-span-2 break-all rounded-lg bg-surface-muted p-2 text-xs">Uploaded: {objectPath}</p> : null}
    {message ? <p aria-live="polite" className="md:col-span-2 text-xs text-muted-foreground">{message}</p> : null}
    <label className="grid gap-1 text-sm font-semibold md:col-span-2">Evidence explanation<textarea name="note" required minLength={20} maxLength={1000} rows={3} className="rounded-lg border border-input-border bg-background p-3 text-sm" placeholder="Explain what this document demonstrates and its issuing source."/></label>
    <button disabled={uploading || !objectPath} className="min-h-11 justify-self-start rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">{uploading ? "Uploading…" : "Submit evidence for review"}</button>
  </form>;
}
