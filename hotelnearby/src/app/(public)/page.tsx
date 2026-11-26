import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { SITE } from "@/lib/site";
import { getPublicHomepageDestinations } from "@/features/destinations/queries";
import { accommodationCategories } from "@/features/search/types";
import { PromotionRail } from "@/features/promotions/promotion-rail";

const cities = [
  { name: "Ilorin", state: "Kwara State", note: "Launch priority", palette: "from-[#d9e7dd] to-[#a8c7b5]", skyline: "M12 82h20V52h14v30h16V38h16v44h17V58h15v24h18V29h17v53h19V48h15v34h16V62h18v20h16" },
  { name: "Offa", state: "Kwara State", note: "Upcoming destination", palette: "from-[#e9dfc9] to-[#c8ae7b]", skyline: "M10 82h18V58h17v24h15V42h18v40h17V52h16v30h18V34h17v48h17V59h17v23h18" },
  { name: "Omu-Aran", state: "Kwara State", note: "Upcoming destination", palette: "from-[#dce5ec] to-[#9eb6c5]", skyline: "M8 82h20V48h18v34h16V61h17v21h16V37h18v45h16V52h18v30h17V43h18v39h16" },
  { name: "Jebba", state: "Kwara State", note: "Upcoming destination", palette: "from-[#e9dfd4] to-[#c5a98e]", skyline: "M10 82h20V57h16v25h17V44h18v38h16V54h17v28h17V34h18v48h16V60h18v22h17" },
  { name: "Lafiagi", state: "Kwara State", note: "Upcoming destination", palette: "from-[#dce8d2] to-[#a7bd8e]", skyline: "M8 82h20V62h16v20h18V47h18v35h16V57h17v25h18V39h17v43h17V52h18v30h16" },
  { name: "Patigi", state: "Kwara State", note: "Upcoming destination", palette: "from-[#e7e0ee] to-[#b6a5cb]", skyline: "M10 82h18V55h17v27h17V41h18v41h17V59h16v23h18V32h18v50h16V50h18v32h17" },
  { name: "Kaiama", state: "Kwara State", note: "Upcoming destination", palette: "from-[#e8e4d2] to-[#c7bf91]", skyline: "M8 82h18V57h18v25h16V46h17v36h18V60h17v22h17V36h18v46h17V55h18v27h16" },
  { name: "Igbaja", state: "Kwara State", note: "Upcoming destination", palette: "from-[#d8e6e8] to-[#9cbec1]", skyline: "M10 82h18V54h18v28h16V42h18v40h16V58h17v24h18V35h17v47h17V52h18v30h16" },
];

export const metadata: Metadata = {
  title: "Find hotels, shortlets and serviced apartments across Nigeria",
  description: "Discover hotels, serviced apartments, shortlets and other accommodation across Nigeria, starting with Ilorin and Kwara. Compare published details and contact providers directly.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: "Find accommodation across Nigeria | Hotelnearby", description: SITE.description },
};

const categories: [string, string, string][] = [
  ["Hotels", "Comfortable stays for short visits and longer trips", "▦"],
  ["Serviced apartments", "Extra space with the comforts of home", "⌂"],
  ["Shortlets", "Flexible furnished places to stay", "◇"],
  ["Guest houses", "Welcoming, independent accommodation", "⌂"],
  ["Lodges & resorts", "Relaxed stays and getaway settings", "⌁"],
  ["Villas & holiday homes", "Private spaces for family and group trips", "⌂"],
  ["Hostels", "Practical stays for budget-conscious travellers", "▤"],
  ["Boutique stays", "Distinctive places with their own character", "✳"],
];

function SectionIntro({ eyebrow, title, body, href, linkLabel }: { eyebrow: string; title: string; body: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">{eyebrow}</p>
        <Heading as="h2" size="h2">{title}</Heading>
        <Text tone="muted" className="mt-2">{body}</Text>
      </div>
      {href && linkLabel ? <Link href={href} className="inline-flex min-h-10 items-center text-sm font-bold text-primary underline-offset-4 hover:underline">{linkLabel} <span aria-hidden="true" className="ml-2">→</span></Link> : null}
    </div>
  );
}

type CityCard = { name: string; state: string; slug: string; status: string; approvedCount?: number; note: string; palette: string; skyline: string };

async function getHomepageCities(): Promise<CityCard[]> {
  const selected = await getPublicHomepageDestinations();
  if (selected === null) {
    return cities.map((city) => ({ ...city, slug: city.name.toLowerCase().replaceAll(" ", "-"), status: "upcoming" }));
  }
  return selected.map((destination, index) => {
    const artwork = cities[index % cities.length]!;
    return {
      name: destination.name,
      slug: destination.slug,
      state: destination.stateName === "Federal Capital Territory" ? destination.stateName : `${destination.stateName} State`,
      status: destination.publicationStatus,
      approvedCount: destination.approvedPropertyCount,
      note: destination.publicationStatus === "published" ? "Destination guide published" : "Upcoming destination",
      palette: artwork.palette,
      skyline: artwork.skyline,
    };
  });
}

async function HomepageDestinationsSection() {
  const homepageCities = await getHomepageCities();
  return (
      <Section spacing="lg" className="pb-12 sm:pb-16">
        <Container>
          <SectionIntro eyebrow="Start exploring" title="Discover places across Nigeria" body="Explore destinations starting with Kwara State. Destination visibility and property counts will reflect approved platform data." href="/destinations" linkLabel="Explore all destinations" />
          <div className="hotel-bento-grid">
            {homepageCities.map((city) => (
              <Link key={city.name} href={`/destinations/${city.slug}`} className="hotel-bento-card group focus-visible:outline-offset-4">
                <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${city.palette}`}>
                  <div className="absolute -right-3 -top-5 h-24 w-24 rounded-full bg-white/40" />
                  <svg viewBox="0 0 240 100" className="absolute inset-x-0 bottom-0 h-28 w-full" aria-hidden="true">
                    <path d="M0 85 Q55 60 110 80 T240 70 V100 H0Z" fill="#6f927c" opacity=".35" />
                    <path d={city.skyline} fill="#315d4c" opacity=".88" />
                    <path d="M0 88 Q60 75 120 88 T240 82 V100 H0Z" fill="#172b46" opacity=".8" />
                  </svg>
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-[#172b46]">{city.status === "published" ? "EXPLORE" : "UPCOMING"}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2"><div><h3 className="font-extrabold">{city.name}</h3><p className="mt-0.5 text-sm text-muted-foreground">{city.state}</p></div><span className="text-lg text-accent-text" aria-hidden="true">↗</span></div>
                  <p className="mt-3 text-xs font-semibold text-muted-foreground">{city.note}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{city.approvedCount && city.approvedCount > 0 ? `${city.approvedCount} approved properties` : "No approved listing count published yet."}</p>
                </div>
              </Link>
            ))}
          </div>
          {homepageCities.length === 0 ? <p className="rounded-xl border border-dashed border-border bg-surface p-7 text-center text-sm text-muted-foreground">No destinations have been selected for the homepage yet. Please check back as our destination coverage grows.</p> : null}
          <p className="mt-4 text-xs text-muted-foreground">Administrators select and order homepage cities. System recommendations require administrator approval. Property counts come only from approved listing metrics.</p>
        </Container>
      </Section>

  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#172b46] text-white">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/homepage-hero.webp')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(12,27,47,.94)_0%,rgba(12,27,47,.78)_48%,rgba(12,27,47,.35)_100%)]" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#102039]/70 via-transparent to-[#102039]/15" aria-hidden="true" />
        <Container className="relative grid gap-10 py-16 sm:py-20 lg:min-h-[610px] lg:grid-cols-[1.05fr_.78fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.19em] text-[#f0d6a8] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d7b77f]" /> Your next stay starts here
            </p>
            <Heading as="h1" size="display" className="max-w-2xl font-editorial text-[clamp(3rem,6.2vw,5.7rem)] font-normal leading-[.99] tracking-[-.035em] text-white">Find a place that feels like <span className="text-[#e4c894]">your kind of stay.</span></Heading>
            <Text size="body-lg" className="mt-6 max-w-xl text-[15px] leading-8 text-white/80 sm:text-lg">{SITE.description}</Text>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold text-white/85">
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 backdrop-blur-sm">Explore accommodation across Nigeria</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 backdrop-blur-sm">Connect with providers directly</span>
            </div>
          </div>
          <div className="hotel-glass-panel w-full max-w-[470px] justify-self-start rounded-[1.6rem] p-5 text-[#252c35] sm:p-7 lg:justify-self-end">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9a7848]">Start exploring</p>
                <h2 className="mt-2 font-editorial text-3xl leading-tight text-[#172b46]">Find your next stay</h2>
                <p className="mt-2 text-xs leading-5 text-[#687384]">Discover places and compare the details that matter.</p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f1ece1] text-xl text-[#8a6b3c]" aria-hidden="true">⌕</span>
            </div>
            <form action="/search" method="get" className="grid gap-4">
              <label className="grid gap-2 text-xs font-extrabold text-[#35445a]" htmlFor="home-location">Where would you like to stay?
                <input id="home-location" name="q" type="search" placeholder="Enter a city, state or area" className="min-h-[54px] rounded-xl border border-[#d9dce1] bg-white px-4 text-sm font-medium text-[#252c35] outline-none transition placeholder:font-normal placeholder:text-[#8a929d] focus:border-[#a9854e] focus:ring-2 focus:ring-[#c9a66b]/20" />
              </label>
              <label className="grid gap-2 text-xs font-extrabold text-[#35445a]" htmlFor="home-category">What kind of accommodation?
                <select id="home-category" name="category" defaultValue="" className="min-h-[54px] rounded-xl border border-[#d9dce1] bg-white px-4 text-sm font-medium text-[#35445a] outline-none transition focus:border-[#a9854e] focus:ring-2 focus:ring-[#c9a66b]/20">
                  <option value="">All accommodation types</option>
                  {accommodationCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid min-w-0 gap-2 text-xs font-extrabold text-[#35445a]" htmlFor="home-min-price">Minimum price
                  <input id="home-min-price" name="minPrice" inputMode="numeric" type="number" min="0" placeholder="₦ Minimum" className="min-h-[50px] w-full min-w-0 rounded-xl border border-[#d9dce1] bg-white px-3 text-sm font-medium text-[#252c35] outline-none placeholder:font-normal placeholder:text-[#8a929d] focus:border-[#a9854e]" />
                </label>
                <label className="grid min-w-0 gap-2 text-xs font-extrabold text-[#35445a]" htmlFor="home-max-price">Maximum price
                  <input id="home-max-price" name="maxPrice" inputMode="numeric" type="number" min="0" placeholder="₦ Maximum" className="min-h-[50px] w-full min-w-0 rounded-xl border border-[#d9dce1] bg-white px-3 text-sm font-medium text-[#252c35] outline-none placeholder:font-normal placeholder:text-[#8a929d] focus:border-[#a9854e]" />
                </label>
              </div>
              <button type="submit" className="mt-1 inline-flex min-h-[54px] items-center justify-center rounded-xl bg-[#172b46] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#263f60]">Explore accommodation <span aria-hidden="true" className="ml-2 text-lg">→</span></button>
            </form>
            <p className="mt-4 text-center text-[11px] leading-5 text-[#7b8490]">No booking or payment here. Confirm prices and availability directly with each property.</p>
          </div>
        </Container>
        <div className="border-t border-white/15 bg-[#102039]/45 backdrop-blur-sm">
          <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4 text-[11px] font-bold tracking-wide text-white/75 sm:justify-start">
            <span>Thoughtful discovery</span><span className="hidden h-1 w-1 rounded-full bg-[#d9b77d] sm:block" /><span>Local destinations</span><span className="hidden h-1 w-1 rounded-full bg-[#d9b77d] sm:block" /><span>Direct property contact</span>
          </Container>
        </div>
      </section>

      <Suspense fallback={<Section spacing="lg" className="pb-12 sm:pb-16"><Container><p className="text-sm text-muted-foreground">Loading selected destinations…</p></Container></Section>}><HomepageDestinationsSection /></Suspense>
      <PromotionRail types={["homepage", "featured"]} title="Featured accommodation" />

      <Section spacing="lg">
        <Container>
          <SectionIntro eyebrow="Find your kind of stay" title="Explore accommodation types" body="Different trips call for different places. Browse the accommodation style that suits your plans." href="/categories" linkLabel="View all categories" />
          <div className="hotel-bento-grid">
            {categories.map(([name, description, symbol]) => (
              <Link key={name} href={`/categories?type=${encodeURIComponent(name)}`} className="hotel-bento-card group p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-2xl text-primary" aria-hidden="true">{symbol}</span>
                <h3 className="mt-4 font-extrabold">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                <span className="mt-4 inline-flex text-sm font-bold text-accent-text">Explore type <span aria-hidden="true" className="ml-2">→</span></span>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="muted" spacing="lg">
        <Container>
          <SectionIntro eyebrow="Recently added" title="Newly listed properties" body="Fresh accommodation listings will appear after provider submission and administrator approval." />
          <div className="rounded-xl border border-dashed border-border bg-background px-6 py-9 text-center">
            <Heading as="h3" size="h3">No approved listings to show yet</Heading>
            <Text tone="muted" className="mx-auto mt-2 max-w-xl">We will show real property information here when approved listings become available. Hotelnearby does not publish sample properties as if they were real.</Text>
            <Link href="/providers/register" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-input-border px-5 text-sm font-bold hover:bg-surface-muted">Become a listing provider</Link>
          </div>
        </Container>
      </Section>

      <Section spacing="lg">
        <Container>
          <SectionIntro eyebrow="Beyond the stay" title="Nearby attractions and experiences" body="Discover attractions, restaurants, parks, shopping and useful local services around the destinations you are exploring." href="/nearby" linkLabel="Explore nearby places" />
          <div className="grid gap-4 md:grid-cols-3">
            {["Attractions & landmarks", "Food, culture & local spots", "Things to do"].map((item, i) => <div key={item} className="hotel-bento-card p-5"><span className="text-xs font-extrabold uppercase tracking-wider text-accent-text">0{i + 1}</span><h3 className="mt-3 font-extrabold">{item}</h3><p className="mt-1 text-sm text-muted-foreground">Approved local discoveries will be added as reliable information becomes available.</p></div>)}
          </div>
        </Container>
      </Section>

      <Section tone="muted" spacing="lg">
        <Container>
          <SectionIntro eyebrow="Ideas for the journey" title="The Travel Journal" body="Destination guides, practical travel tips and local stories, reviewed before publication." href="/journal" linkLabel="Visit the journal" />
          <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center"><Heading as="h3" size="h3">Stories are being prepared</Heading><Text tone="muted" className="mt-2">Our editorial team has not published any journal articles yet.</Text></div>
        </Container>
      </Section>

      <Section spacing="lg">
        <Container>
          <SectionIntro eyebrow="What is happening" title="Events and experiences" body="Find events and experiences that can help you make more of a visit." href="/events" linkLabel="See events" />
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center"><Heading as="h3" size="h3">No upcoming events published</Heading><Text tone="muted" className="mt-2">Verified event details will appear here after review. Hotelnearby does not sell event tickets.</Text></div>
        </Container>
      </Section>

      <Section tone="brand" spacing="lg">
        <Container className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-surface-accent">Stay in the know</p><Heading as="h2" size="h2" className="mt-2 text-white">Travel ideas, not inbox noise.</Heading><Text className="mt-2 max-w-2xl text-brand-surface-muted">Our newsletter will share destination inspiration and useful travel updates. Sign-up will open when the mailing and consent system is ready.</Text></div>
          <div className="rounded-lg border border-white/20 bg-white/10 px-5 py-4 text-sm text-brand-surface-muted"><p className="font-bold text-white">Newsletter registration is not open yet.</p><p className="mt-1">Consent, privacy information and unsubscribe controls will be provided before sign-up is enabled.</p><Link href="/privacy" className="mt-3 inline-flex font-bold text-brand-surface-accent underline underline-offset-4">Read our privacy notice</Link></div>
        </Container>
      </Section>

      <Section spacing="md">
        <Container>
          <SectionIntro eyebrow="Start with Kwara" title="Accommodation in Ilorin and Kwara" body="Explore published hotels, shortlets and serviced apartments when listings are available. Each property page shows the information currently supplied and approved for publication." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([ ["Hotels in Ilorin", "/accommodation/ilorin/hotels"], ["Shortlets in Ilorin", "/accommodation/ilorin/shortlets"], ["Serviced apartments in Ilorin", "/accommodation/ilorin/serviced-apartments"], ["Accommodation in Kwara", "/accommodation/kwara/hotels"] ] as const).map(([label, href]) => <Link key={href} href={href} className="rounded-xl border border-border bg-surface p-4 text-sm font-extrabold hover:border-accent hover:bg-surface-muted">{label} <span aria-hidden="true">→</span></Link>)}
          </div>
        </Container>
      </Section>

      <Section spacing="md">
        <Container className="hotel-bento-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div><Heading as="h2" size="h2">Have a place worth discovering?</Heading><Text tone="muted" className="mt-2 max-w-2xl">Introduce your accommodation to people exploring Nigeria. Listings are reviewed before they go public.</Text></div>
          <Link href="/providers/register" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-primary px-6 text-sm font-extrabold text-primary-foreground hover:bg-primary-hover">List your property <span aria-hidden="true" className="ml-2">→</span></Link>
        </Container>
      </Section>
    </>
  );
}
