import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { getPublicEnv } from "@/lib/env/public";

export const revalidate = 900;
const locations = {
  ilorin: { name: "Ilorin", state: "Kwara", field: "city_name" as const, value: "Ilorin" },
  kwara: { name: "Kwara", state: "Nigeria", field: "state_name" as const, value: "Kwara" },
} as const;
const categories = {
  hotels: { label: "Hotels", value: "hotel", singular: "hotel" },
  shortlets: { label: "Shortlets", value: "shortlet", singular: "shortlet" },
  "serviced-apartments": { label: "Serviced apartments", value: "serviced-apartment", singular: "serviced apartment" },
} as const;
type Params = { location: string; category: string };
type Listing = { id: string; name: string; slug: string; description: string; city_name: string | null; state_name: string | null; price_amount: number | null; price_basis: string | null; cover_image_url: string | null; verification_status: string; amenities: string[]; features: string[] };

async function getListings(location: (typeof locations)[keyof typeof locations], category: (typeof categories)[keyof typeof categories]) {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) return [] as Listing[];
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let query = supabase.from("public_property_search").select("id,name,slug,description,city_name,state_name,price_amount,price_basis,cover_image_url,verification_status,amenities,features").eq("category", category.value).order("updated_at", { ascending: false }).limit(100);
  query = query.eq(location.field, location.value);
  const { data } = await query;
  return ((data ?? []) as Listing[]).filter((item) => item.description.trim().length >= 80 && (Boolean(item.cover_image_url) || item.amenities.length + item.features.length >= 3)).slice(0, 24);
}

export async function generateStaticParams() {
  return Object.keys(locations).flatMap((location) => Object.keys(categories).map((category) => ({ location, category })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { location: locationSlug, category: categorySlug } = await params;
  const location = locations[locationSlug as keyof typeof locations];
  const category = categories[categorySlug as keyof typeof categories];
  if (!location || !category) return { title: "Accommodation not found", robots: { index: false, follow: true } };
  const listings = await getListings(location, category);
  const title = `${category.label} in ${location.name}, ${location.state}`;
  return {
    title,
    description: `Explore ${category.label.toLowerCase()} in ${location.name}${location.name === "Kwara" ? " State" : ""}, Nigeria. Review published property details and contact accommodation providers directly.`,
    alternates: { canonical: `/accommodation/${locationSlug}/${categorySlug}` },
    robots: { index: listings.length >= 3, follow: true },
    openGraph: { type: "website", title, description: `Published ${category.label.toLowerCase()} listings in ${location.name}, Nigeria.` },
  };
}

function priceLabel(item: Listing) {
  if (item.price_amount === null) return "Contact property for price";
  return `${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(item.price_amount)}${item.price_basis ? ` / ${item.price_basis}` : ""}`;
}

export default async function AccommodationLandingPage({ params }: { params: Promise<Params> }) {
  const { location: locationSlug, category: categorySlug } = await params;
  const location = locations[locationSlug as keyof typeof locations];
  const category = categories[categorySlug as keyof typeof categories];
  if (!location || !category) notFound();
  const listings = await getListings(location, category);
  const indexable = listings.length >= 3;
  const title = `${category.label} in ${location.name}`;
  return <Section spacing="lg"><Container>
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Accommodation", href: "/categories" }, { label: location.name, href: locationSlug === "ilorin" ? "/destinations/ilorin" : "/destinations/state/kwara" }, { label: category.label }]} />
    <div className="mt-8 max-w-3xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">Accommodation directory · Nigeria</p><Heading as="h1" size="display" className="mt-3">{title}{locationSlug === "ilorin" ? ", Kwara State" : " State, Nigeria"}</Heading><Text size="body-lg" tone="muted" className="mt-4">Browse published {category.label.toLowerCase()} in {location.name}. Listing information is supplied by accommodation providers and reviewed under Hotelnearby&apos;s publication process. Contact each property directly to confirm current details, prices and availability.</Text></div>
    <div className="mt-8 flex flex-wrap gap-2">{Object.entries(categories).map(([slug, item]) => <Link key={slug} href={`/accommodation/${locationSlug}/${slug}`} className={`rounded-full border px-4 py-2 text-sm font-bold ${slug === categorySlug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted"}`}>{item.label}</Link>)}</div>
    {listings.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-surface">{item.cover_image_url ? <div className="aspect-[16/10] bg-surface-muted"><img src={item.cover_image_url} alt={`${item.name} ${category.singular} in ${location.name}`} loading="lazy" decoding="async" className="h-full w-full object-cover" /></div> : null}<div className="p-4"><h2 className="font-extrabold"><Link href={`/properties/${item.slug}`} className="hover:underline">{item.name}</Link></h2><p className="mt-1 text-sm text-muted-foreground">{[item.city_name, item.state_name, "Nigeria"].filter(Boolean).join(", ")}</p><p className="mt-3 text-sm font-bold text-primary">{priceLabel(item)}</p><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.description || "Property details are available on the listing page."}</p><Link href={`/properties/${item.slug}`} className="mt-4 inline-flex min-h-10 items-center text-sm font-bold text-accent-text underline">View property details</Link></div></article>)}</div> : <div className="mt-8 rounded-xl border border-dashed border-border p-8"><Heading as="h2" size="h3">No published {category.label.toLowerCase()} to display yet</Heading><Text tone="muted" className="mt-2">This page will show listings when approved property records are available. We do not create placeholder properties, reviews or prices.</Text><Link href="/providers/register" className="mt-4 inline-flex font-bold text-accent-text underline">List an accommodation</Link></div>}
    {!indexable ? <p className="mt-6 text-xs text-muted-foreground">Search indexing is held until this page has enough published listings to provide a useful choice.</p> : null}
    <div className="mt-10 grid gap-3 rounded-xl bg-surface-muted p-5 sm:grid-cols-2"><div><h2 className="font-extrabold">Explore accommodation in Ilorin</h2><p className="mt-1 text-sm text-muted-foreground">Browse hotels, shortlets and serviced apartments in Ilorin.</p></div><Link href="/destinations/ilorin" className="self-center text-sm font-bold text-accent-text underline">Ilorin destination guide</Link><Link href="/search?q=Ilorin" className="text-sm font-bold text-accent-text underline">Search all accommodation in Ilorin</Link><Link href="/destinations" className="text-sm font-bold text-accent-text underline">Explore destinations across Nigeria</Link></div>
  </Container></Section>;
}
