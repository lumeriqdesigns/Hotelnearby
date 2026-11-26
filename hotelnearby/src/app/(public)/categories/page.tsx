import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { PromotionRail } from "@/features/promotions/promotion-rail";
import type { Metadata } from "next";
import Link from "next/link";
import { accommodationCategories } from "@/features/search/types";

export const metadata: Metadata = { title: "Accommodation types across Nigeria", description: "Explore hotels, serviced apartments, shortlets, guest houses, lodges, resorts, hostels, villas and other accommodation types.", alternates: { canonical: "/categories" } };

export default function Page() {
  return (
    <>
    <PromotionRail types={["category"]} title="Sponsored accommodation by category" />
    <Section spacing="lg">
      <Container size="narrow">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Hotelnearby</p>
        <Heading as="h1" size="display">Explore accommodation types</Heading>
        <Text size="body-lg" tone="muted" className="mt-5">Browse hotels, serviced apartments, shortlets, guest houses, lodges, resorts, boutique stays, hostels, villas and holiday homes. Choose a category to search approved property listings across Nigeria; availability and current terms must be confirmed directly with each provider.</Text>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{accommodationCategories.map((category) => <Link key={category.value} href={`/search?category=${encodeURIComponent(category.value)}`} className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent hover:bg-surface-muted"><h2 className="font-extrabold">{category.label}</h2><p className="mt-2 text-sm text-muted-foreground">Explore published {category.label.toLowerCase()} listings and compare the details providers have supplied.</p><span className="mt-4 inline-flex text-sm font-bold text-accent-text underline">Browse {category.label.toLowerCase()}</span></Link>)}</div>
      </Container>
    </Section>
    </>
  );
}
