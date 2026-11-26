import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { getStateBySlug, getTownsForState, NIGERIAN_STATES } from "@/features/destinations/data";
import { getPublicEnv } from "@/lib/env/public";

export const dynamicParams = false;
export function generateStaticParams() {
  return NIGERIAN_STATES.map((state) => ({ stateSlug: state.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ stateSlug: string }> }): Promise<Metadata> {
  const { stateSlug } = await params;
  const state = getStateBySlug(stateSlug);
  if (!state) return { title: "State not found", robots: { index: false, follow: false } };
  const stateLabel = state.name === "Federal Capital Territory" ? state.name : `${state.name} State`;
  return {
    title: `${stateLabel} – Explore destinations`,
    description: `Browse launch-priority towns and destination information for ${stateLabel}, Nigeria. Guides are published when verified information and approved accommodation are available.`,
    alternates: { canonical: `${getPublicEnv().siteUrl}/destinations/state/${state.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function StateDestinationPage({ params }: { params: Promise<{ stateSlug: string }> }) {
  const { stateSlug } = await params;
  const state = getStateBySlug(stateSlug);
  if (!state) notFound();
  const towns = getTownsForState(state.name);
  const stateLabel = state.name === "Federal Capital Territory" ? state.name : `${state.name} State`;

  return (
    <Section spacing="lg">
      <Container>
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Destinations", href: "/destinations" }, { label: state.name }]} />
        <div className="mt-8 max-w-3xl"><span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Destination coverage in progress</span><p className="mt-5 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">{state.region} · Nigeria</p><Heading as="h1" size="display" className="mt-2">Explore {stateLabel}.</Heading><Text size="body-lg" tone="muted" className="mt-4">{stateLabel} is included in Hotelnearby&apos;s nationwide geographic directory. Detailed destination guides will be published when genuine local information and approved accommodation listings meet our quality threshold.</Text><p className="mt-3 text-sm text-muted-foreground">State capital: {state.capital}</p></div>
        <div className="mt-10"><Heading as="h2" size="h2">Launch-priority towns</Heading>{towns.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{towns.map((town) => <Link key={town.slug} href={`/destinations/${town.slug}`} className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent hover:shadow-sm"><span className="font-extrabold">{town.name}</span><span className="mt-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Upcoming destination</span></Link>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">No launch-priority towns are currently configured for this state. This does not prevent the location database from supporting it.</p>}</div>
        <div className="mt-10 rounded-xl bg-surface-muted p-5"><h2 className="font-extrabold">Destination publication status</h2><p className="mt-2 text-sm text-muted-foreground">This state profile is not currently indexed by search engines. No accommodation count or visitor claim is published until supported by approved platform records.</p><Link href="/destinations" className="mt-4 inline-flex text-sm font-bold text-accent-text underline-offset-4 hover:underline">Browse all Nigerian states →</Link></div>
      </Container>
    </Section>
  );
}
