import { Heading, Text } from "@/components/ui/typography";
import { SignInForm } from "@/features/auth/auth-forms";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";

export default function Page() {
  return <AuthSplitLayout><p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-accent-text">Your Hotelnearby account</p><Heading as="h2" size="display">Welcome back</Heading><Text size="body-lg" tone="muted" className="mt-4">Sign in securely to manage your profile, enquiries or property listings.</Text><div className="hotel-glass-panel mt-8 rounded-2xl p-6 sm:p-8"><SignInForm /></div><p className="mt-6 text-center text-sm text-muted-foreground">New to Hotelnearby? <Link href="/register" className="font-semibold text-accent-text hover:underline">Create an account</Link></p><p className="mt-3 text-center text-sm text-muted-foreground">Property owner? <Link href="/providers/register" className="font-semibold text-accent-text hover:underline">Register your property</Link></p></AuthSplitLayout>;
}
