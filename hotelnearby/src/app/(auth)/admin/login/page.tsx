import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Heading, Text } from "@/components/ui/typography";
import { AdminSignInForm } from "@/features/auth/admin-sign-in-form";

export default function AdminLoginPage() {
  return <AuthSplitLayout eyebrow="HOTELNEARBY · CONTROL CENTRE" title="Thoughtful stays. Seamless operations.">
    <p className="mb-3 text-xs font-extrabold uppercase tracking-[.18em] text-accent-text">Administrator access</p>
    <Heading as="h2" size="display">Welcome back</Heading>
    <Text size="body-lg" tone="muted" className="mt-3">Sign in with your authorised administrator or moderator account.</Text>
    <div className="hotel-glass-panel mt-8 rounded-2xl p-6 sm:p-8"><AdminSignInForm /></div>
    <p className="mt-6 text-center text-sm text-muted-foreground">Not an administrator? <Link href="/sign-in" className="font-semibold text-accent-text hover:underline">Go to regular sign in</Link></p>
  </AuthSplitLayout>;
}
