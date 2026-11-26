import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Heading, Text } from "@/components/ui/typography";
import { SignInForm } from "@/features/auth/auth-forms";

export default function ProviderSignInPage() {
  return <AuthSplitLayout eyebrow="HOTELNEARBY · PROVIDER PORTAL" title="Your property. Your guests. One simple workspace.">
    <p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-accent-text">Provider workspace</p>
    <Heading as="h2" size="display">Welcome back</Heading>
    <Text size="body-lg" tone="muted" className="mt-4">Sign in to manage your accommodation listings, enquiries and organisation.</Text>
    <div className="hotel-glass-panel mt-8 rounded-2xl p-6 sm:p-8"><SignInForm /></div>
    <p className="mt-6 text-center text-sm text-muted-foreground">New provider? <Link href="/providers/register" className="font-semibold text-accent-text hover:underline">Create a provider account</Link></p>
  </AuthSplitLayout>;
}
