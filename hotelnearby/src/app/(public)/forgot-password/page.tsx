import Link from "next/link";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { PasswordRecoveryForm } from "@/features/auth/auth-forms";

export default function Page() {
  return <Section spacing="lg" className="hotel-auth-shell"><Container size="narrow">
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Account recovery</p>
    <Heading as="h1" size="display">Reset your password</Heading>
    <Text size="body-lg" tone="muted" className="mt-4">Enter the email address linked to your Hotelnearby account. We will send a secure recovery link if an account exists.</Text>
    <div className="mt-8 hotel-glass-panel rounded-2xl p-6 sm:p-8"><PasswordRecoveryForm/></div>
    <Link href="/sign-in" className="mt-6 inline-flex text-sm font-semibold text-accent-text hover:underline">Return to sign in</Link>
  </Container></Section>;
}
