import Link from "next/link";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { UpdatePasswordForm } from "@/features/auth/auth-forms";
import { requireAuthenticatedUser } from "@/features/auth/authorization";

export default async function Page() {
  await requireAuthenticatedUser("/forgot-password");
  return <Section spacing="lg" className="hotel-auth-shell"><Container size="narrow">
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Secure recovery</p>
    <Heading as="h1" size="display">Choose a new password</Heading>
    <Text size="body-lg" tone="muted" className="mt-4">Your recovery link has been verified. Choose a new password to secure your account.</Text>
    <div className="mt-8 hotel-glass-panel rounded-2xl p-6 sm:p-8"><UpdatePasswordForm/></div>
    <Link href="/sign-in" className="mt-6 inline-flex text-sm font-semibold text-accent-text hover:underline">Return to sign in</Link>
  </Container></Section>;
}
