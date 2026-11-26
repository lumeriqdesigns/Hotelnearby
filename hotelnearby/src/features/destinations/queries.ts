import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";


export type HomepageDestination = {
  id: string;
  name: string;
  slug: string;
  stateName: string;
  stateSlug: string;
  publicationStatus: string;
  approvedPropertyCount: number;
};

/** Returns null when Supabase is not configured/unavailable, and [] when admin selected no cities. */
export async function getPublicHomepageDestinations(): Promise<HomepageDestination[] | null> {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  try {
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("homepage_destination_cards")
      .select("id,name,slug,state_name,state_slug,publication_status,approved_property_count")
      .order("display_order", { ascending: true });
    if (error) return null;
    return (data ?? []).map((destination) => ({
      id: destination.id,
      name: destination.name,
      slug: destination.slug,
      stateName: destination.state_name,
      stateSlug: destination.state_slug,
      publicationStatus: destination.publication_status,
      approvedPropertyCount: destination.approved_property_count,
    }));
  } catch {
    return null;
  }
}

export type PublicDestination = {
  id: string;
  name: string;
  slug: string;
  stateName: string;
  stateSlug: string;
  publicationStatus: string;
  editorialSummary: string;
  approvedPropertyCount: number;
  visitorInformation: Record<string, string>;
  transportInformation: Record<string, string>;
  neighbourhoods: string[];
  landmarks: string[];
  contentItems: { type: string; title: string; summary: string }[];
};

/** Public, RLS-governed lookup. It never uses a service-role key. */
export async function getPublicDestinationBySlug(slug: string): Promise<PublicDestination | null> {
  try {
    const env = getPublicEnv();
    if (!env.supabaseUrl || !env.supabaseAnonKey) return null;

    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: route, error: routeError } = await supabase
      .from("public_destination_routes")
      .select("id,name,slug,state_name,state_slug,publication_status,approved_property_count")
      .eq("slug", slug)
      .maybeSingle();
    if (routeError || !route) return null;

    // Selected upcoming destinations get a safe placeholder only; draft editorial data stays private.
    if (route.publication_status !== "published") {
      return {
        id: route.id,
        name: route.name,
        slug: route.slug,
        stateName: route.state_name,
        stateSlug: route.state_slug,
        publicationStatus: route.publication_status,
        editorialSummary: "",
        approvedPropertyCount: route.approved_property_count ?? 0,
        visitorInformation: {},
        transportInformation: {},
        neighbourhoods: [],
        landmarks: [],
        contentItems: [],
      };
    }

    const [{ data: profile, error: profileError }, { data: neighbourhoodRows }, { data: contentItems }] = await Promise.all([
      supabase.from("destination_profiles").select("editorial_summary,visitor_information,transport_information").eq("location_id", route.id).maybeSingle(),
      supabase.from("location_nodes").select("id,name").eq("parent_id", route.id).eq("level", "neighbourhood").eq("is_active", true),
      supabase.from("destination_content_items").select("content_type,title,summary").eq("location_id", route.id).eq("publication_status", "published").eq("verification_status", "verified"),
    ]);
    if (profileError || !profile) return null;
    const neighbourhoodIds = (neighbourhoodRows ?? []).map((item) => item.id);
    const { data: landmarkRows } = neighbourhoodIds.length
      ? await supabase.from("location_nodes").select("name").eq("level", "landmark").eq("is_active", true).in("parent_id", [route.id, ...neighbourhoodIds])
      : await supabase.from("location_nodes").select("name").eq("level", "landmark").eq("parent_id", route.id).eq("is_active", true);
    return {
      id: route.id,
      name: route.name,
      slug: route.slug,
      stateName: route.state_name,
      stateSlug: route.state_slug,
      publicationStatus: route.publication_status,
      editorialSummary: profile.editorial_summary,
      approvedPropertyCount: route.approved_property_count ?? 0,
      visitorInformation: (profile.visitor_information ?? {}) as Record<string, string>,
      transportInformation: (profile.transport_information ?? {}) as Record<string, string>,
      neighbourhoods: (neighbourhoodRows ?? []).map((item) => item.name),
      landmarks: (landmarkRows ?? []).map((item) => item.name),
      contentItems: (contentItems ?? []).map((item) => ({ type: item.content_type, title: item.title, summary: item.summary })),
    };
  } catch {
    return null;
  }
}
