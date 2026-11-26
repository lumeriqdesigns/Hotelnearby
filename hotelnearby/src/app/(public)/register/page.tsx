import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { RegisterForm } from "@/features/auth/auth-forms";

export default function Page() {
  return <Section spacing="lg" className="hotel-auth-shell"><Container size="narrow">
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Join Hotelnearby</p>
    <Heading as="h1" size="display">Create your account</Heading>
    <Text size="body-lg" tone="muted" className="mt-4">Choose a visitor account or register as a property owner. Email verification is required before account access.</Text>
    <div className="mt-8 hotel-glass-panel rounded-2xl p-6 sm:p-8"><RegisterForm/></div>
  </Container></Section>;
}
