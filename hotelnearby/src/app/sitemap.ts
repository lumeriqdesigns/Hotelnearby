import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const env = getPublicEnv();
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/destinations`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/categories`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.3 },
  ];
  if (!env.supabaseUrl || !env.supabaseAnonKey) return staticRoutes;
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [properties, destinations, articles, categories, attractions, businesses, events, accommodationPages, attractionCount, businessCount, eventCount] = await Promise.all([
    supabase.from("public_property_search").select("slug,updated_at,description,cover_image_url,amenities,features").order("updated_at", { ascending: false }).limit(10000),
    supabase.from("public_destination_routes").select("slug").eq("publication_status", "published"),
    supabase.from("blog_articles").select("slug,updated_at,published_at,canonical_path,category_id").eq("status", "published").lte("published_at", now.toISOString()),
    supabase.from("blog_categories").select("id,slug,updated_at").eq("is_active", true),
    supabase.from("attractions").select("slug,updated_at,location:location_nodes!inner(slug)").eq("publication_status", "published").eq("verification_status", "verified"),
    supabase.from("local_businesses").select("slug,updated_at,location:location_nodes!inner(slug)").eq("publication_status", "published").eq("verification_status", "verified"),
    supabase.from("events").select("slug,updated_at,location:location_nodes!inner(slug)").eq("publication_status", "published").eq("verification_status", "verified").or(`starts_at.gte.${now.toISOString()},ends_at.gte.${now.toISOString()}`),
    supabase.from("public_property_search").select("category,city_name,state_name,description,cover_image_url,amenities,features").in("category", ["hotel", "shortlet", "serviced-apartment"]).or("city_name.eq.Ilorin,state_name.eq.Kwara"),
    supabase.from("attractions").select("id", { count: "exact", head: true }).eq("publication_status", "published").eq("verification_status", "verified"),
    supabase.from("local_businesses").select("id", { count: "exact", head: true }).eq("publication_status", "published").eq("verification_status", "verified"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("publication_status", "published").eq("verification_status", "verified").or(`starts_at.gte.${now.toISOString()},ends_at.gte.${now.toISOString()}`),
  ]);
  const articleRows = articles.data ?? [];
  const canonicalArticles = articleRows.filter((article) => !article.canonical_path || article.canonical_path.startsWith("/journal/"));
  const populatedCategoryIds = new Set(canonicalArticles.map((article) => article.category_id));
  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...(canonicalArticles.length > 0 ? [{ url: `${base}/journal`, changeFrequency: "weekly" as const, priority: 0.7 }] : []),
    ...((attractionCount.count ?? 0) + (businessCount.count ?? 0) > 0 ? [{ url: `${base}/nearby`, changeFrequency: "weekly" as const, priority: 0.5 }] : []),
    ...((eventCount.count ?? 0) > 0 ? [{ url: `${base}/events`, changeFrequency: "weekly" as const, priority: 0.5 }] : []),
    ...[...(accommodationPages.data ?? []).filter((row) => (row.description ?? "").trim().length >= 80 && (Boolean(row.cover_image_url) || (row.amenities?.length ?? 0) + (row.features?.length ?? 0) >= 3)).reduce((counts, row) => {
      const key = row.city_name === "Ilorin" ? "ilorin" : row.state_name === "Kwara" ? "kwara" : null;
      if (key) { const routeCategory = row.category === "hotel" ? "hotels" : row.category === "shortlet" ? "shortlets" : row.category === "serviced-apartment" ? "serviced-apartments" : null; if (routeCategory) counts.set(`${key}/${routeCategory}`, (counts.get(`${key}/${routeCategory}`) ?? 0) + 1); }
      return counts;
    }, new Map<string, number>())].filter(([, count]) => count >= 3).map(([path]) => ({ url: `${base}/accommodation/${path}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...(properties.data ?? []).filter((p) => (p.description ?? "").trim().length >= 80 && (Boolean(p.cover_image_url) || (p.amenities?.length ?? 0) + (p.features?.length ?? 0) >= 3)).map((p) => ({ url: `${base}/properties/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : undefined, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...(destinations.data ?? []).map((d) => ({ url: `${base}/destinations/${d.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...canonicalArticles.map((a) => ({ url: `${base}/journal/${a.slug}`, lastModified: a.updated_at || a.published_at ? new Date(a.updated_at ?? a.published_at!) : undefined, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...(categories.data ?? []).filter((c) => populatedCategoryIds.has(c.id)).map((c) => ({ url: `${base}/journal/category/${c.slug}`, lastModified: c.updated_at ? new Date(c.updated_at) : undefined, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...(attractions.data ?? []).map((p: any) => ({ url: `${base}/nearby/${p.location.slug}/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : undefined, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...(businesses.data ?? []).map((p: any) => ({ url: `${base}/nearby/${p.location.slug}/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : undefined, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...(events.data ?? []).map((p: any) => ({ url: `${base}/events/${p.location.slug}/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : undefined, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
  return [...staticRoutes, ...dynamicRoutes];
}
