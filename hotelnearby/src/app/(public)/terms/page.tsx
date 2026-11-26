import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";

export default function Page() {
  return (
    <Section spacing="lg">
      <Container size="narrow">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Hotelnearby</p>
        <Heading as="h1" size="display">Terms of use</Heading>
        <Text size="body-lg" tone="muted" className="mt-5">The terms of use will be published before public launch and will describe acceptable use, provider responsibilities, listing standards and the limits of the discovery service.</Text>
      </Container>
    </Section>
  );
}
