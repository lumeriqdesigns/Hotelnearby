import Link from "next/link";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { acceptTeamInvitationAction } from "@/features/organisations/actions";
import { requireAuthenticatedUser } from "@/features/auth/authorization";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  await requireAuthenticatedUser();
  return <Section spacing="lg"><Container size="narrow"><Heading as="h1" size="display">Accept team invitation</Heading><Text tone="muted" className="mt-3">You must be signed in with the verified email address the invitation was sent to.</Text><form action={acceptTeamInvitationAction} className="mt-7 rounded-xl border border-border bg-surface p-6"><input type="hidden" name="token" value={token}/><button disabled={!/^[a-f0-9]{64}$/i.test(token)} className="min-h-11 rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-50">Accept invitation</button></form><Link href="/dashboard" className="mt-5 inline-flex text-sm font-bold text-accent-text underline">Return to dashboard</Link></Container></Section>;
}
