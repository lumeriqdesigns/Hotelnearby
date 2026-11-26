import { redirect } from "next/navigation";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { requirePlatformRoles } from "@/features/auth/authorization";
import { createPropertyAction } from "@/features/organisations/actions";

export default async function NewPropertyPage() {
  const { profile, supabase } = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const [{ data: memberships }, { data: locations }] = await Promise.all([
    supabase.from("provider_memberships").select("organisation_id,provider_organisations(name)").eq("user_id", profile.id),
    supabase.from("location_nodes").select("id,name,level,parent_id").eq("is_active", true).order("name"),
  ]);
  if (!memberships?.length) redirect("/dashboard");
  const locationLabels = new Map((locations ?? []).map((l) => [l.id, l.name]));
  return <Section spacing="lg"><Container size="narrow">
    <p className="text-xs font-extrabold uppercase tracking-widest text-accent-text">Provider workspace</p><Heading as="h1" size="display" className="mt-3">Create a property</Heading><Text tone="muted" className="mt-3">Start with the basics. You can save an incomplete draft and finish the listing later. Prefer guided help? <a href="/dashboard/ai-listing" className="font-bold text-accent-text underline">Use the AI Listing Guide</a>.</Text>
    <form action={createPropertyAction} className="mt-8 grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <label className="grid gap-1.5 text-sm font-bold">Organisation<select name="organisationId" required className="min-h-11 rounded-md border border-input-border bg-background px-3">{memberships.map((m) => <option key={m.organisation_id} value={m.organisation_id}>{(m.provider_organisations as unknown as {name:string})?.name ?? "Provider organisation"}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-bold">Property name<input name="name" required minLength={2} maxLength={160} placeholder="e.g. Lush Gardens Hotel" className="min-h-11 rounded-md border border-input-border bg-background px-3 font-normal"/></label>
      <label className="grid gap-1.5 text-sm font-bold">Accommodation category<select name="category" required className="min-h-11 rounded-md border border-input-border bg-background px-3 font-normal">{[["hotel","Hotel"],["serviced-apartment","Serviced apartment"],["shortlet","Shortlet"],["guest-house","Guest house"],["lodge","Lodge"],["resort","Resort"],["boutique-stay","Boutique stay"],["hostel","Hostel"],["villa","Villa"],["holiday-home","Holiday home"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-bold">Town, city or area<select name="locationId" required defaultValue="" className="min-h-11 rounded-md border border-input-border bg-background px-3 font-normal"><option value="" disabled>Select a location</option>{(locations ?? []).filter((l) => ["city_town","neighbourhood","landmark"].includes(l.level)).map((l) => <option key={l.id} value={l.id}>{[locationLabels.get(l.parent_id ?? ""),l.name].filter(Boolean).join(" · ")}</option>)}</select></label>
      <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground">Create draft</button><a href="/dashboard" className="inline-flex min-h-11 items-center rounded-lg border border-input-border px-5 text-sm font-bold">Cancel</a></div>
    </form>
  </Container></Section>;
}
