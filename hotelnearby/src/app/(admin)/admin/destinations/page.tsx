import { Suspense } from "react";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { NIGERIAN_STATES } from "@/features/destinations/data";
import { getPublicEnv } from "@/lib/env/public";
import { requirePlatformRoles } from "@/features/auth/authorization";

import { addDestinationContentItem, addDestinationPlace, saveDestinationControls, saveDestinationEditorial } from "./actions";

export const metadata = { title: "Destination administration | Hotelnearby", robots: { index: false, follow: false } };

type AdminDestination = {
  location_id: string;
  editorial_summary: string;
  manually_selected: boolean;
  display_order: number;
  publication_status: string;
  canonical_path: string;
  recommendation_score?: number;
  approved_property_count?: number;
  listing_growth_30d?: number;
  search_demand_30d?: number;
  property_views_30d?: number;
  engagement_30d?: number;
  contact_activity_30d?: number;
  location: { name: string; slug: string; level: string; stateName?: string } | null;
  contentItems: { id: string; content_type: string; title: string; summary: string; publication_status: string }[];
  places: { id: string; name: string; level: string; slug: string }[];
};

async function AdminDestinationsContent({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return <Section spacing="lg"><Container size="narrow"><Heading as="h1" size="h1">Destination administration</Heading><Text tone="muted" className="mt-3">Connect Supabase and apply the Prompt 6 database migration before using destination administration.</Text></Container></Section>;
  }
  const { supabase } = await requirePlatformRoles(["administrator"]);

  const [{ data: locations, error: locationsError }, { data: profiles, error: profilesError }, { data: recommendations }, { data: contentItems, error: contentError }, { data: places, error: placesError }] = await Promise.all([
    supabase.from("location_nodes").select("id,name,slug,level,parent_id,region,administrative_capital").eq("level", "city_town").order("name"),
    supabase.from("destination_profiles").select("location_id,editorial_summary,manually_selected,display_order,publication_status,canonical_path"),
    supabase.from("destination_recommendations").select("location_id,recommendation_score,approved_property_count,listing_growth_30d,search_demand_30d,property_views_30d,engagement_30d,contact_activity_30d"),
    supabase.from("destination_content_items").select("id,location_id,content_type,title,summary,publication_status").order("created_at", { ascending: false }),
    supabase.from("location_nodes").select("id,name,slug,level,parent_id").in("level", ["neighbourhood", "landmark"]).order("name"),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.location_id, profile]));
  const recommendationById = new Map((recommendations ?? []).map((item) => [item.location_id, item]));
  const contentById = new Map<string, AdminDestination["contentItems"]>();
  for (const item of contentItems ?? []) {
    const current = contentById.get(item.location_id) ?? [];
    current.push(item);
    contentById.set(item.location_id, current);
  }
  const placesByParent = new Map<string, AdminDestination["places"]>();
  for (const place of places ?? []) {
    if (!place.parent_id) continue;
    const current = placesByParent.get(place.parent_id) ?? [];
    current.push(place);
    placesByParent.set(place.parent_id, current);
  }
  const destinations: AdminDestination[] = (locations ?? []).map((location) => {
    const profile = profileById.get(location.id);
    const recommendation = recommendationById.get(location.id);
    return {
      location_id: location.id,
      editorial_summary: profile?.editorial_summary ?? "",
      manually_selected: profile?.manually_selected ?? false,
      display_order: profile?.display_order ?? 0,
      publication_status: profile?.publication_status ?? "upcoming",
      canonical_path: profile?.canonical_path ?? `/destinations/${location.slug}`,
      recommendation_score: recommendation?.recommendation_score,
      approved_property_count: recommendation?.approved_property_count,
      listing_growth_30d: recommendation?.listing_growth_30d,
      search_demand_30d: recommendation?.search_demand_30d,
      property_views_30d: recommendation?.property_views_30d,
      engagement_30d: recommendation?.engagement_30d,
      contact_activity_30d: recommendation?.contact_activity_30d,
      location: { name: location.name, slug: location.slug, level: location.level },
      contentItems: contentById.get(location.id) ?? [],
      places: placesByParent.get(location.id) ?? [],
    };
  });
  const { saved } = await searchParams;

  return (
    <Section spacing="lg">
      <Container>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">Administrator control centre</p>
        <Heading as="h1" size="display">Destination management</Heading>
        <Text tone="muted" className="mt-3 max-w-3xl">Manually select and order homepage destinations, prepare editorial information and submit destinations for publication. Recommendations remain subject to administrator approval. Publishing is blocked by database quality thresholds.</Text>
        {saved ? <p role="status" className="mt-5 rounded-lg border border-emerald-700/20 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Destination changes saved.</p> : null}
        {locationsError || profilesError ? <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-900">Destination data could not be loaded. Apply the Prompt 6 migration and check database access.</p> : null}
        {contentError || placesError ? <p role="alert" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-900">Some destination content or neighbourhood/landmark records could not be loaded. Confirm the complete Prompt 6 migration is applied.</p> : null}
        <div className="mt-8 grid gap-5">{destinations.map((destination) => <article key={destination.location_id} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">{destination.location?.name}</h2><p className="mt-1 text-xs text-muted-foreground">{destination.canonical_path} · {destination.publication_status.replace("_", " ")}</p></div><span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold">{destination.publication_status}</span></div>
          {destination.recommendation_score !== undefined ? <div className="mt-4 rounded-lg bg-surface-muted p-3"><p className="text-xs font-extrabold uppercase tracking-wider text-accent-text">System recommendation · administrator decision required</p><p className="mt-1 text-sm font-bold">Signal score: {(destination.recommendation_score * 100).toFixed(1)} / 100</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Approved properties: {destination.approved_property_count ?? 0} · Listing growth (30d): {destination.listing_growth_30d ?? 0} · Searches (30d): {destination.search_demand_30d ?? 0} · Views (30d): {destination.property_views_30d ?? 0} · Engagement (30d): {destination.engagement_30d ?? 0} · Contact activity (30d): {destination.contact_activity_30d ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Equal-weight percentile ranking across six signals. This score does not publish or select a destination.</p></div> : null}
          <form action={saveDestinationControls} className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
            <input type="hidden" name="locationId" value={destination.location_id}/>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="manuallySelected" defaultChecked={destination.manually_selected} className="size-4 accent-primary"/> Select for homepage city section</label>
            <label className="grid gap-1 text-sm font-semibold">Display order<input type="number" min="0" max="100000" name="displayOrder" defaultValue={destination.display_order} className="min-h-10 rounded-md border border-input-border bg-background px-3 font-normal"/></label>
            <button className="min-h-10 rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted" type="submit">Save display</button>
          </form>
          <form action={saveDestinationEditorial} className="mt-4 grid gap-3 border-t border-border pt-4">
            <input type="hidden" name="locationId" value={destination.location_id}/>
            <label className="grid gap-1 text-sm font-semibold">Editorial destination overview<textarea name="editorialSummary" rows={3} defaultValue={destination.editorial_summary} placeholder="Add fact-checked, useful destination information..." className="rounded-md border border-input-border bg-background p-3 font-normal"/></label>
            <div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm font-semibold">Publication status<select name="status" defaultValue={destination.publication_status} className="min-h-10 rounded-md border border-input-border bg-background px-3 font-normal"><option value="upcoming">Upcoming</option><option value="in_review">In review</option><option value="published">Published (quality gate applies)</option><option value="unpublished">Unpublished</option></select></label><button className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover" type="submit">Save editorial status</button></div>
          </form>
          <div className="mt-5 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
            <div>
              <h3 className="font-bold">Neighbourhoods and landmarks</h3>
              {destination.places.length ? <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{destination.places.map((place) => <li key={place.id}>{place.name} <span className="text-xs uppercase">({place.level.replace("_", " ")})</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No verified neighbourhoods or landmarks have been added.</p>}
              <form action={addDestinationPlace} className="mt-3 grid gap-2">
                <input type="hidden" name="parentId" value={destination.location_id}/>
                <label className="grid gap-1 text-xs font-bold">Add place type<select name="level" className="min-h-10 rounded-md border border-input-border bg-background px-3 text-sm font-normal"><option value="neighbourhood">Neighbourhood</option><option value="landmark">Landmark</option></select></label>
                <label className="grid gap-1 text-xs font-bold">Place name<input name="name" minLength={2} maxLength={120} required placeholder="Enter a verified name" className="min-h-10 rounded-md border border-input-border bg-background px-3 text-sm font-normal"/></label>
                <button type="submit" className="min-h-10 justify-self-start rounded-lg border border-input-border px-4 text-sm font-bold hover:bg-surface-muted">Add place</button>
              </form>
            </div>
            <div>
              <h3 className="font-bold">Reviewed destination content</h3>
              {destination.contentItems.length ? <ul className="mt-2 space-y-2">{destination.contentItems.map((item) => <li key={item.id} className="rounded-md bg-surface-muted p-2"><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-muted-foreground">{item.content_type.replace("_", " ")} · {item.publication_status}</p></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No destination content has been added.</p>}
              <form action={addDestinationContentItem} className="mt-3 grid gap-2">
                <input type="hidden" name="locationId" value={destination.location_id}/>
                <label className="grid gap-1 text-xs font-bold">Content type<select name="contentType" className="min-h-10 rounded-md border border-input-border bg-background px-3 text-sm font-normal"><option value="attraction">Attraction</option><option value="local_business">Restaurant / local business</option><option value="event">Event / experience</option><option value="transport">Transport information</option><option value="guide">Travel guide</option><option value="visitor_information">Visitor information</option></select></label>
                <label className="grid gap-1 text-xs font-bold">Title<input name="title" minLength={3} maxLength={160} required className="min-h-10 rounded-md border border-input-border bg-background px-3 text-sm font-normal"/></label>
                <label className="grid gap-1 text-xs font-bold">Fact-checked summary<textarea name="summary" minLength={40} maxLength={1200} rows={3} required placeholder="Write 40–1,200 characters based on reliable information" className="rounded-md border border-input-border bg-background p-3 text-sm font-normal"/></label>
                <label className="grid gap-1 text-xs font-bold">Source reference<input name="sourceReference" maxLength={500} placeholder="URL or internal source reference" className="min-h-10 rounded-md border border-input-border bg-background px-3 text-sm font-normal"/></label>
                <label className="grid gap-1 text-xs font-bold">Publication status<select name="status" defaultValue="in_review" className="min-h-10 rounded-md border border-input-border bg-background px-3 text-sm font-normal"><option value="draft">Draft</option><option value="in_review">In review</option><option value="published">Publish (requires source and verification)</option><option value="unpublished">Unpublished</option></select></label>
                <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" name="verified" className="size-4 accent-primary"/> I have verified this information against the source</label>
                <button type="submit" className="min-h-10 justify-self-start rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover">Save destination content</button>
              </form>
            </div>
          </div>
        </article>)}</div>
        <p className="mt-7 text-xs text-muted-foreground">Geographic directory supports {NIGERIAN_STATES.length - 1} states and the Federal Capital Territory. This page reads authenticated Supabase data; it does not fabricate recommendation metrics or listing counts.</p>
      </Container>
    </Section>
  );
}


export default function AdminDestinationsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  return <Suspense fallback={<Section spacing="lg"><Container><p className="text-sm text-muted-foreground">Loading destination administration…</p></Container></Section>}><AdminDestinationsContent searchParams={searchParams} /></Suspense>;
}
