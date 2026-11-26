import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";

export default function Page() {
  return (
    <Section spacing="lg">
      <Container size="narrow">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Hotelnearby</p>
        <Heading as="h1" size="display">About Hotelnearby</Heading>
        <Text size="body-lg" tone="muted" className="mt-5">Hotelnearby helps people discover, compare and contact accommodation providers directly across Nigeria, starting with destination coverage in Kwara State.</Text>
        <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground"><p>Our directory brings accommodation information into one place so visitors can review published property details, explore destinations and contact providers using the contact information shown on each listing.</p><p>Property information is supplied by providers and reviewed under platform publication rules. A verified label records a platform verification decision; it is not a guarantee of quality, safety, current prices or availability. Visitors should confirm important details directly with the property.</p><p>Hotelnearby is a discovery platform, not a booking agent. We do not confirm room availability, make accommodation reservations or process guest accommodation payments. Any provider subscription or advertising payment is separate from a guest&apos;s arrangements with a property.</p></div>
        <div className="mt-8 flex flex-wrap gap-3"><a href="/destinations" className="rounded-lg border border-border px-4 py-3 text-sm font-bold">Explore destinations</a><a href="/contact" className="rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Contact Hotelnearby</a></div>
      </Container>
    </Section>
  );
}
