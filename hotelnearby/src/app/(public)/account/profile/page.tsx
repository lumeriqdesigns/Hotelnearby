import Link from "next/link";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { ProfileForm } from "@/features/auth/auth-forms";
import { requireAuthenticatedUser } from "@/features/auth/authorization";
import { signOutAction, signOutEverywhereAction } from "@/features/auth/actions";

const roleLabels = {
  visitor: "Visitor",
  provider_owner: "Provider owner",
  provider_staff: "Provider staff",
  administrator: "Administrator",
  editor_moderator: "Editor / moderator",
} as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const { profile, user } = await requireAuthenticatedUser();
  const params = await searchParams;
  return <Section spacing="lg"><Container size="narrow">
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-accent-text">Your Hotelnearby account</p>
    <Heading as="h1" size="display">Account profile</Heading>
    <Text size="body-lg" tone="muted" className="mt-4">Manage your account details and security settings.</Text>
    {params.password === "updated" ? <p role="status" className="mt-5 rounded-lg border border-emerald-700/20 bg-emerald-50 p-3 text-sm text-emerald-900">Your password has been updated.</p> : null}
    <div className="mt-7 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Signed in as</p><p className="mt-1 font-bold">{user.email}</p><p className="mt-1 text-sm text-muted-foreground">{roleLabels[profile.role]}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${profile.email_verified_at ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{profile.email_verified_at ? "Email verified" : "Email verification pending"}</span></div>
      <ProfileForm fullName={profile.full_name} phone={profile.phone}/>
      <div className="mt-7 flex flex-wrap gap-3 border-t border-border pt-5"><Link href="/account/security" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-bold hover:bg-surface-muted">Security & MFA</Link>{profile.role === "provider_owner" || profile.role === "provider_staff" ? <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-bold hover:bg-surface-muted">Provider dashboard</Link> : null}{profile.role === "administrator" || profile.role === "editor_moderator" ? <Link href="/admin/destinations" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-bold hover:bg-surface-muted">Administration</Link> : null}<form action={signOutAction}><button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover">Sign out</button></form><form action={signOutEverywhereAction}><button type="submit" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-bold hover:bg-surface-muted">Sign out all devices</button></form></div>
    </div>
  </Container></Section>;
}
