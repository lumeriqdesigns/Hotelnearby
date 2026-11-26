"use client";

import { useMemo, useState } from "react";
import { createAiAssistedPropertyDraftAction } from "@/features/organisations/actions";
import type { ListingGuideSuggestions } from "@/features/ai-listing/types";

const categories = [
  ["hotel","Hotel"],["serviced-apartment","Serviced apartment"],["shortlet","Shortlet"],["guest-house","Guest house"],["lodge","Lodge"],["resort","Resort"],["boutique-stay","Boutique stay"],["hostel","Hostel"],["villa","Villa"],["holiday-home","Holiday home"],
];
const questionFields = [
  { key: "whatItIs", label: "What kind of accommodation is it?", placeholder: "Describe the property in your own words." },
  { key: "roomsOrUnits", label: "What rooms or apartment units do you offer?", placeholder: "For hotels, describe room TYPES. For apartments, describe the individual units. Do not guess quantities." },
  { key: "locationDescription", label: "What location details can you confirm?", placeholder: "Town, neighbourhood, nearby landmark or directions. Do not enter an invented address." },
  { key: "pricing", label: "How do you price your accommodation?", placeholder: "Enter the price and whether it is per night, day, week, month, stay or another basis. Leave blank if not decided." },
  { key: "knownFacilities", label: "Which facilities and amenities are actually available?", placeholder: "Only list facilities you have confirmed." },
  { key: "guestExperience", label: "What should a visitor know before contacting you?", placeholder: "Describe the real experience, house rules and useful information." },
];

type Organisation = { id: string; name: string };
type Location = { id: string; name: string; level: string; parent_id: string | null };

export function AiListingGuide({ organisations, locations }: { organisations: Organisation[]; locations: Location[] }) {
  const [organisationId, setOrganisationId] = useState(organisations[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [providerNotes, setProviderNotes] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [suggestions, setSuggestions] = useState<ListingGuideSuggestions | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [category, setCategory] = useState("");
  const [locationId, setLocationId] = useState("");
  const [address, setAddress] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceBasis, setPriceBasis] = useState("");
  const [description, setDescription] = useState("");
  const [houseRules, setHouseRules] = useState("");
  const [useAiDescription, setUseAiDescription] = useState(false);
  const [useAiHouseRules, setUseAiHouseRules] = useState(false);
  const [confirmedAmenities, setConfirmedAmenities] = useState<string[]>([]);

  const locationOptions = useMemo(() => locations.filter((item) => ["city_town","neighbourhood","landmark"].includes(item.level)), [locations]);

  async function generateGuidance() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/provider/ai-listing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organisationId, sessionId: sessionId || undefined, answers, providerNotes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not generate listing guidance.");
      setSessionId(result.sessionId); setSuggestions(result.suggestions); setTurnCount(result.turnCount);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  function toggleAmenity(value: string) {
    setConfirmedAmenities((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  if (!organisations.length) return <div className="rounded-xl border border-border bg-surface p-5">No provider organisation is connected to this account. Create or join an organisation before using the AI guide.</div>;

  return <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-widest text-accent-text">AI-assisted listing</p><h2 className="mt-2 text-xl font-extrabold">Tell us about your property</h2><p className="mt-2 text-sm text-muted-foreground">Answer only what you know. You can skip anything you have not confirmed.</p></div><span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold">Step {turnCount + 1} of 12</span></div>
      <label className="mt-6 grid gap-1.5 text-sm font-bold">Organisation<select value={organisationId} onChange={(e)=>setOrganisationId(e.target.value)} className="min-h-11 rounded-lg border border-input-border bg-background px-3">{organisations.map((o)=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <div className="mt-5 grid gap-4">{questionFields.map((field)=><label key={field.key} className="grid gap-1.5 text-sm font-bold">{field.label}<textarea rows={2} maxLength={1200} value={answers[field.key] ?? ""} onChange={(e)=>setAnswers((current)=>({...current,[field.key]:e.target.value}))} placeholder={field.placeholder} className="rounded-lg border border-input-border bg-background p-3 font-normal"/></label>)}
        <label className="grid gap-1.5 text-sm font-bold">Anything else you want the guide to know? <span className="font-normal text-muted-foreground">Optional notes, maximum 4,000 characters.</span><textarea rows={3} maxLength={4000} value={providerNotes} onChange={(e)=>setProviderNotes(e.target.value)} className="rounded-lg border border-input-border bg-background p-3 font-normal"/></label>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm">{error}</p> : null}
      <button type="button" disabled={loading || !organisationId} onClick={generateGuidance} className="mt-5 min-h-12 rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{loading ? "Preparing guidance…" : sessionId ? "Update my guidance" : "Generate listing guidance"}</button>
      <p className="mt-3 text-xs text-muted-foreground">Limit: 20 AI generations per organisation per UTC day; up to 12 steps per guide. Manual listing is always available.</p>
    </section>

    <section className="grid content-start gap-5">
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6"><h2 className="text-lg font-extrabold">Guide suggestions</h2><p className="mt-1 text-sm text-muted-foreground">Suggestions are not facts. Review and edit everything before saving.</p>
        {!suggestions ? <p className="mt-5 rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">Your guidance will appear here after you submit your answers.</p> : <div className="mt-4 grid gap-4 text-sm">
          {suggestions.suggestedCategory ? <div><p className="font-bold">Suggested category: {suggestions.suggestedCategory.replaceAll("-"," ")}</p><p className="mt-1 text-muted-foreground">{suggestions.categoryReason}</p></div> : null}
          {suggestions.descriptionDraft ? <div><p className="font-bold">Suggested description draft</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{suggestions.descriptionDraft}</p></div> : null}
          {suggestions.houseRulesDraft ? <div><p className="font-bold">Suggested house-rules draft</p><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{suggestions.houseRulesDraft}</p></div> : null}
          {suggestions.nextQuestion ? <div className="rounded-lg bg-surface-muted p-3"><p className="font-bold">Next question</p><p className="mt-1">{suggestions.nextQuestion}</p>{suggestions.nextQuestionOptions.length ? <p className="mt-2 text-xs text-muted-foreground">Possible answers: {suggestions.nextQuestionOptions.join(" · ")}</p> : null}</div> : null}
          {suggestions.locationQuestions.length ? <div><p className="font-bold">Location details to confirm</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{suggestions.locationQuestions.map((v,i)=><li key={i}>{v}</li>)}</ul></div> : null}
          {suggestions.roomOrUnitGuidance.length ? <div><p className="font-bold">Rooms and units</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{suggestions.roomOrUnitGuidance.map((v,i)=><li key={i}>{v}</li>)}</ul></div> : null}
          {suggestions.pricingBasisExplanation ? <div><p className="font-bold">Pricing basis</p><p className="mt-1 text-muted-foreground">{suggestions.pricingBasisExplanation}</p></div> : null}
          {suggestions.photoGuidance.length ? <div><p className="font-bold">Photo guidance</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{suggestions.photoGuidance.map((v,i)=><li key={i}>{v}</li>)}</ul></div> : null}
          {suggestions.missingFacts.length ? <div><p className="font-bold">Facts still needed</p><ul className="mt-1 list-disc pl-5 text-muted-foreground">{suggestions.missingFacts.map((v,i)=><li key={i}>{v}</li>)}</ul></div> : null}
          {suggestions.completenessChecklist.length ? <div><p className="font-bold">Completeness checklist</p><ul className="mt-1 grid gap-1 text-muted-foreground">{suggestions.completenessChecklist.map((v,i)=><li key={i}>{v.status === "provided" ? "✓" : v.status === "confirm" ? "!" : "○"} {v.label}</li>)}</ul></div> : null}
          {suggestions.suggestedAmenities.length ? <fieldset><legend className="font-bold">Amenities to confirm</legend><p className="mb-2 text-xs text-muted-foreground">Select only facilities that are genuinely available. Nothing is added unless you select it.</p><div className="grid gap-2">{suggestions.suggestedAmenities.map((v)=><label key={v} className="flex items-center gap-2"><input type="checkbox" checked={confirmedAmenities.includes(v)} onChange={()=>toggleAmenity(v)}/>{v}</label>)}</div></fieldset> : null}
        </div>}
      </div>

      {suggestions && sessionId ? <form action={createAiAssistedPropertyDraftAction} className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div><h2 className="text-lg font-extrabold">Review and save a draft</h2><p className="mt-1 text-sm text-muted-foreground">This creates an unpublished draft only. You control every field below.</p></div>
        <input type="hidden" name="organisationId" value={organisationId}/><input type="hidden" name="sessionId" value={sessionId}/>
        <label className="grid gap-1 text-sm font-bold">Property name<input required minLength={2} maxLength={160} value={propertyName} onChange={(e)=>setPropertyName(e.target.value)} name="name" className="min-h-10 rounded border border-input-border bg-background px-3 font-normal"/></label>
        <label className="grid gap-1 text-sm font-bold">Accommodation category<select required name="category" value={category} onChange={(e)=>setCategory(e.target.value)} className="min-h-10 rounded border border-input-border bg-background px-3 font-normal"><option value="">Choose the correct category</option>{categories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">Verified location in Hotelnearby<select required name="locationId" value={locationId} onChange={(e)=>setLocationId(e.target.value)} className="min-h-10 rounded border border-input-border bg-background px-3 font-normal"><option value="">Choose the actual location</option>{locationOptions.map((l)=><option key={l.id} value={l.id}>{l.name} ({l.level.replaceAll("_"," ")})</option>)}</select></label>
        <label className="grid gap-1 text-sm font-bold">Street address or directions <span className="font-normal text-muted-foreground">Enter only an address you can confirm.</span><input name="address" maxLength={500} value={address} onChange={(e)=>setAddress(e.target.value)} className="min-h-10 rounded border border-input-border bg-background px-3 font-normal"/></label>
        <label className="grid gap-1 text-sm font-bold">Description<textarea name="description" rows={5} maxLength={5000} value={description} onChange={(e)=>{setDescription(e.target.value);setUseAiDescription(false);}} className="rounded border border-input-border bg-background p-3 font-normal"/></label>
        {suggestions.descriptionDraft ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="useAiDescription" checked={useAiDescription} onChange={(e)=>setUseAiDescription(e.target.checked)}/><span>Use the AI description draft shown in the guide suggestions. I have reviewed it and want to apply it to this draft.</span></label> : null}
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-bold">Price (optional)<input type="number" min="0" step="0.01" name="priceAmount" value={priceAmount} onChange={(e)=>setPriceAmount(e.target.value)} className="min-h-10 rounded border border-input-border bg-background px-3 font-normal"/></label><label className="grid gap-1 text-sm font-bold">Pricing basis<select name="priceBasis" value={priceBasis} onChange={(e)=>setPriceBasis(e.target.value)} className="min-h-10 rounded border border-input-border bg-background px-2 font-normal"><option value="">Not set</option>{[["night","Per night"],["day","Per day"],["week","Per week"],["month","Per month"],["stay","Per stay"],["other","Other"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
        <label className="grid gap-1 text-sm font-bold">Additional amenities you have confirmed <span className="font-normal text-muted-foreground">Comma-separated; optional.</span><input name="providerAmenities" className="min-h-10 rounded border border-input-border bg-background px-3 font-normal"/></label>
        {confirmedAmenities.map((v)=><input key={v} type="hidden" name="confirmedAmenity" value={v}/>)}
        <label className="grid gap-1 text-sm font-bold">House rules<textarea name="houseRules" rows={3} maxLength={3000} value={houseRules} onChange={(e)=>{setHouseRules(e.target.value);setUseAiHouseRules(false);}} className="rounded border border-input-border bg-background p-3 font-normal"/></label>
        {suggestions.houseRulesDraft ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="useAiHouseRules" checked={useAiHouseRules} onChange={(e)=>setUseAiHouseRules(e.target.checked)}/><span>Use the AI house-rules draft shown in the guide suggestions. I have reviewed it and want to apply it to this draft.</span></label> : null}
        <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground">Save as an unpublished property draft</button>
        <p className="text-xs text-muted-foreground">Saving does not submit or approve the listing. You can continue editing it in the provider dashboard. Administrator approval is required before publication.</p>
      </form> : null}
    </section>
  </div>;
}
