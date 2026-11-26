import Link from "next/link";

import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { AiListingGuide } from "@/features/ai-listing/ai-listing-guide";
import { requirePlatformRoles } from "@/features/auth/authorization";

export default async function AiListingPage() {
  const { profile, supabase } = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  const [{ data: memberships }, { data: locations }] = await Promise.all([
    supabase.from("provider_memberships").select("organisation_id,provider_organisations(name)").eq("user_id", profile.id),
    supabase.from("location_nodes").select("id,name,level,parent_id").eq("is_active", true).order("name"),
  ]);
  const organisations = (memberships ?? []).map((m) => ({ id: m.organisation_id, name: (m.provider_organisations as unknown as { name: string } | null)?.name ?? "Provider organisation" }));
  return <Section spacing="lg"><Container size="wide">
    <div className="mb-8"><Link href="/dashboard" className="text-sm font-bold text-accent-text underline">← Provider dashboard</Link><p className="mt-5 text-xs font-extrabold uppercase tracking-widest text-accent-text">Hotelnearby provider tools</p><Heading as="h1" size="display" className="mt-2">AI Listing Guide</Heading><Text tone="muted" className="mt-3 max-w-3xl">A guided assistant that helps you prepare an accurate accommodation listing. You remain responsible for every fact, and every listing still requires administrator approval.</Text></div>
    <div className="mb-6 rounded-xl border border-accent/30 bg-surface p-4 text-sm"><strong>AI is optional.</strong> Prefer standard listing? <Link href="/dashboard/properties/new" className="font-bold text-accent-text underline">Create a property manually</Link>. The AI guide does not verify properties, invent missing facts, check availability or make bookings.</div>
    <AiListingGuide organisations={organisations} locations={locations ?? []}/>
  </Container></Section>;
}
