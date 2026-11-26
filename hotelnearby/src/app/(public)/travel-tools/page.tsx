import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { TravelToolsDashboard } from "@/features/visitor/travel-tools-dashboard";

export const metadata: Metadata = {
  title: "Travel planning tools | Hotelnearby",
  description: "Compare accommodation, save properties, plan budgets, organise group stays and prepare your trip with Hotelnearby visitor tools.",
  alternates: { canonical: "/travel-tools" },
};
export default function TravelToolsPage() {
  return <><Section tone="brand" spacing="md"><Container><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-surface-accent">Plan with confidence</p><Heading as="h1" size="display" className="mt-3 text-white">Your travel planning toolkit</Heading><Text className="mt-3 max-w-2xl text-brand-surface-muted">Compare real accommodation listings, organise your budget and prepare the details of your trip. You can browse and use the tools without registering.</Text></Container></Section><Section spacing="lg"><Container><TravelToolsDashboard/></Container></Section></>;
}
