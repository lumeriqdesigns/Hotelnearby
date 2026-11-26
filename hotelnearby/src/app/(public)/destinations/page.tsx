import Link from "next/link";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { LAUNCH_TOWNS, NIGERIAN_STATES } from "@/features/destinations/data";
import { getPublicEnv } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Explore destinations across Nigeria",
  description: "Browse Nigerian states and launch-priority towns. Destination pages become searchable when genuine local information and approved accommodation listings meet publication standards.",
  alternates: { canonical: `${getPublicEnv().siteUrl}/destinations` },
};

type SearchParams = Promise<{ q?: string; state?: string }>;

export default async function DestinationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const selectedState = params.state ?? "";
  const towns = LAUNCH_TOWNS.filter((town) =>
    (!selectedState || town.state.toLowerCase() === selectedState.toLowerCase()) &&
    (!query || `${town.name} ${town.state} Nigeria`.toLowerCase().includes(query)),
  );
  const states = NIGERIAN_STATES.filter((state) => !query || `${state.name} ${state.capital} ${state.region}`.toLowerCase().includes(query));

  return (
    <>
      <Section spacing="lg" className="pb-10">
        <Container>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Destinations" }]} />
          <div className="mt-7 max-w-3xl">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">Explore Nigeria</p>
            <Heading as="h1" size="display">Find your next destination.</Heading>
            <Text size="body-lg" tone="muted" className="mt-4">Explore states, cities and towns across Nigeria. We publish detailed destination guides only when there is enough genuine local information and approved accommodation to make them useful.</Text>
          </div>
          <form action="/destinations" method="get" className="mt-8 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_15rem_auto] sm:items-end">
            <label className="grid gap-1.5 text-sm font-semibold" htmlFor="destination-query">Search a state or launch town
              <input id="destination-query" name="q" type="search" defaultValue={params.q ?? ""} placeholder="Try Ilorin, Kwara or Lagos" className="min-h-12 rounded-lg border border-input-border bg-background px-3 font-normal" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold" htmlFor="destination-state">Filter launch towns by state
              <select id="destination-state" name="state" defaultValue={selectedState} className="min-h-12 rounded-lg border border-input-border bg-background px-3 font-normal">
                <option value="">All launch areas</option><option value="Kwara">Kwara State</option>
              </select>
            </label>
            <button className="min-h-12 rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover" type="submit">Find destinations</button>
          </form>
        </Container>
      </Section>

      <Section tone="muted" spacing="lg">
        <Container>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">Launch priority</p><Heading as="h2" size="h2">Kwara towns</Heading><Text tone="muted" className="mt-2">These destinations are being prepared. No approved listing counts are available to display yet.</Text></div><span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold">{towns.length} destinations</span></div>
          {towns.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{towns.map((town) => <Link key={town.slug} href={`/destinations/${town.slug}`} className="group rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-offset-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-extrabold">{town.name}</h3><p className="mt-1 text-sm text-muted-foreground">{town.state} State, Nigeria</p></div><span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Upcoming</span></div><p className="mt-5 text-sm text-muted-foreground">Destination information and approved accommodation are being gathered.</p><span className="mt-4 inline-flex text-sm font-bold text-accent-text">Explore destination <span aria-hidden="true" className="ml-2">→</span></span></Link>)}</div> : <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">No launch towns match that search. Try another town or clear the filters.</p>}
        </Container>
      </Section>

      <Section spacing="lg">
        <Container>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">Nationwide coverage</p>
          <Heading as="h2" size="h2">Browse all Nigerian states</Heading>
          <Text tone="muted" className="mt-2 max-w-2xl">The location directory is structured to support all 36 states and the Federal Capital Territory. A state appearing here does not mean its destination guide is already published.</Text>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{states.map((state) => <Link key={state.slug} href={`/destinations/state/${state.slug}`} className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent hover:shadow-sm"><span><span className="block font-bold">{state.name}</span><span className="mt-1 block text-xs text-muted-foreground">Capital: {state.capital} · {state.region}</span></span><span className="text-accent-text" aria-hidden="true">→</span></Link>)}</div>
        </Container>
      </Section>
    </>
  );
}
