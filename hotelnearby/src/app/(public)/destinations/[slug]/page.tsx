import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { getTownBySlug } from "@/features/destinations/data";
import { getPublicDestinationBySlug } from "@/features/destinations/queries";
import { getPublicEnv } from "@/lib/env/public";
import { PromotionRail } from "@/features/promotions/promotion-rail";
import { createClient } from "@supabase/supabase-js";

export function generateStaticParams() {
  return ["ilorin", "offa", "omu-aran", "jebba", "lafiagi", "patigi", "kaiama", "osi", "igbaja", "share"].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getPublicDestinationBySlug(slug);
  const knownTown = getTownBySlug(slug);
  const town = knownTown ?? (destination ? { name: destination.name, slug: destination.slug, state: destination.stateName, status: "published" as const } : null);
  if (!town) return { title: "Destination not found", robots: { index: false, follow: false } };
  const isPublished = destination?.publicationStatus === "published";
  return {
    title: `${town.name}, ${town.state} State – Destination information`,
    description: isPublished && destination.editorialSummary ? destination.editorialSummary.slice(0, 160) : `Explore ${town.name} in ${town.state} State, Nigeria. Hotelnearby is preparing verified local information and approved accommodation listings for this destination.`,
    alternates: { canonical: `${getPublicEnv().siteUrl}/destinations/${town.slug}` },
    robots: { index: isPublished, follow: true },
  };
}

const destinationSections: { title: string; description: string; href?: string; contentType?: string }[] = [
  { title: "Accommodation", description: "Approved hotels, serviced apartments, shortlets and other stays will appear when verified listings are available.", href: "/search" },
  { title: "Accommodation categories", description: "Browse the types of accommodation supported by Hotelnearby.", href: "/categories" },
  { title: "Neighbourhoods", description: "Neighbourhood information has not yet been verified for this destination." },
  { title: "Attractions and landmarks", contentType: "attraction", description: "Local attractions and landmark details will be published after editorial verification." },
  { title: "Restaurants and local businesses", contentType: "local_business", description: "Reliable local business information is not yet available for publication." },
  { title: "Events and experiences", contentType: "event", description: "Verified event information will appear here when available.", href: "/events" },
  { title: "Transport information", contentType: "transport", description: "Transport guidance is being researched and will be published when reliable details are available." },
  { title: "Related travel guides", contentType: "guide", description: "Destination guides and visitor information are being prepared.", href: "/journal" },
];

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destination = await getPublicDestinationBySlug(slug);
  const knownTown = getTownBySlug(slug);
  const town = knownTown ?? (destination ? { name: destination.name, slug: destination.slug, state: destination.stateName, status: "published" as const } : null);
  if (!town) notFound();
  const isPublished = destination?.publicationStatus === "published";
  let relatedJournalArticles: { slug: string; title: string; excerpt: string }[] = [];
  if (destination?.id && isPublished) {
    const env = getPublicEnv();
    if (env.supabaseUrl && env.supabaseAnonKey) {
      const journalClient = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const [{ data: directlyRelated }, { data: linkedRows }] = await Promise.all([
        journalClient.from("blog_articles").select("slug,title,excerpt").eq("related_location_id", destination.id).eq("status", "published").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(6),
        journalClient.from("blog_article_destinations").select("article:blog_articles(slug,title,excerpt,published_at,status)").eq("destination_id", destination.id).limit(12),
      ]);
      const linked = (linkedRows ?? []).map((row: any) => row.article).filter((article: any) => article?.status === "published" && article.published_at && new Date(article.published_at) <= new Date());
      relatedJournalArticles = [...(directlyRelated ?? []), ...linked].filter((article, index, all) => all.findIndex((candidate) => candidate.slug === article.slug) === index).slice(0, 6);
    }
  }

  return (
    <>
      <Section tone="brand" spacing="lg" className="pb-14">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Destinations", href: "/destinations" }, { label: town.state, href: `/destinations/state/${destination?.stateSlug ?? "kwara"}` }, { label: town.name }]} />
          <div className="mt-8 max-w-3xl">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-brand-surface-accent">{isPublished ? "Destination guide" : "Upcoming destination"}</span>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[.18em] text-brand-surface-accent">{town.state} State · Nigeria</p>
            <Heading as="h1" size="display" className="mt-2 text-white">Discover {town.name}.</Heading>
            <Text size="body-lg" className="mt-4 max-w-2xl text-brand-surface-muted">{isPublished && destination.editorialSummary ? destination.editorialSummary : `Hotelnearby is preparing a useful destination guide for ${town.name}. We will publish it when there is enough genuine local information and approved accommodation to help visitors make informed decisions.`}</Text>
            <div className="mt-6 flex flex-wrap gap-3"><Link href={`/search?location=${encodeURIComponent(town.name)}`} className="inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-extrabold text-[#172b46] hover:bg-[#f2f0e9]">Check accommodation listings</Link><Link href="/destinations" className="inline-flex min-h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-bold text-white hover:bg-white/10">Browse other destinations</Link></div>
          </div>
        </Container>
      </Section>
      <PromotionRail types={["city"]} citySlug={town.slug} title={`Sponsored stays in ${town.name}`} />
      <Section spacing="lg">
        <Container>
          <div className="mb-7 max-w-2xl"><Heading as="h2" size="h2">Visitor information</Heading><Text tone="muted" className="mt-2">{isPublished ? "This destination guide contains reviewed information and approved accommodation data." : "This destination profile is not yet eligible for search indexing. Sections will be populated only with reviewed, factual information."}</Text></div>
          <div className="grid gap-4 sm:grid-cols-2">{destinationSections.map((section) => {
            const matchingItems = isPublished && section.contentType ? destination?.contentItems.filter((item) => item.type === section.contentType) ?? [] : [];
            const details: string[] = [];
            if (section.title === "Accommodation" && destination?.approvedPropertyCount) details.push(`${destination.approvedPropertyCount} approved properties are currently recorded for ${town.name}.`);
            if (section.title === "Neighbourhoods" && isPublished && destination?.neighbourhoods.length) details.push(destination.neighbourhoods.join(", "));
            if (section.title === "Attractions and landmarks" && isPublished && destination?.landmarks.length) details.push(destination.landmarks.join(", "));
            if (section.title === "Transport information" && isPublished && destination && Object.keys(destination.transportInformation).length) details.push(...Object.entries(destination.transportInformation).map(([key, value]) => `${key}: ${value}`));
            details.push(...matchingItems.map((item) => `${item.title}: ${item.summary}`));
            const detail = details.length ? details.join(" · ") : section.description;
            return <article key={section.title} className="rounded-xl border border-border bg-surface p-5"><h2 className="font-extrabold">{section.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>{section.title === "Accommodation" && town.slug === "ilorin" ? <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{([["Hotels in Ilorin", "hotels"], ["Shortlets in Ilorin", "shortlets"], ["Serviced apartments in Ilorin", "serviced-apartments"]] as const).map(([label, category]) => <Link key={category} href={`/accommodation/ilorin/${category}`} className="text-sm font-bold text-accent-text underline">{label}</Link>)}</div> : null}{section.href ? <Link href={section.href} className="mt-4 inline-flex text-sm font-bold text-accent-text underline-offset-4 hover:underline">Explore {section.title.toLowerCase()} <span aria-hidden="true" className="ml-2">→</span></Link> : null}</article>;
          })}</div>
          {isPublished && destination && (Object.keys(destination.visitorInformation).length > 0 || destination.contentItems.some((item) => item.type === "visitor_information")) ? <div className="mt-8 rounded-xl border border-border bg-surface p-5"><h2 className="font-extrabold">Visitor information</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(destination.visitorInformation).map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl><div className="mt-3 grid gap-3">{destination.contentItems.filter((item) => item.type === "visitor_information").map((item) => <div key={item.title}><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.summary}</p></div>)}</div></div> : null}
          {relatedJournalArticles.length ? <section className="mt-10"><Heading as="h2" size="h2">Travel guides for {town.name}</Heading><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{relatedJournalArticles.map((article) => <article key={article.slug} className="rounded-xl border border-border bg-surface p-5"><h3 className="font-extrabold"><Link href={`/journal/${article.slug}`} className="hover:text-accent-text">{article.title}</Link></h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.excerpt}</p><Link href={`/journal/${article.slug}`} className="mt-4 inline-flex text-sm font-bold text-accent-text underline">Read guide</Link></article>)}</div></section> : null}
          <div className="mt-8 rounded-xl border border-dashed border-border bg-surface-muted p-5"><h2 className="font-extrabold">Current listing information</h2><p className="mt-2 text-sm text-muted-foreground">{destination?.approvedPropertyCount ? `${destination.approvedPropertyCount} approved properties are currently recorded for ${town.name}.` : `No approved property count is available to publish for ${town.name}. Hotelnearby will not display estimated or invented counts.`}</p></div>
        </Container>
      </Section>
    </>
  );
}
