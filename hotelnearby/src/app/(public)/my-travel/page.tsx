import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/ui/container";
import { Heading, Text } from "@/components/ui/typography";
import { TravelToolsDashboard } from "@/features/visitor/travel-tools-dashboard";
export const metadata: Metadata = { title: "My travel | Hotelnearby", robots: { index: false, follow: false } };
export default function MyTravelPage() { return <><Section spacing="md"><Container><Heading as="h1" size="display">My travel</Heading><Text tone="muted" className="mt-2">Your saved accommodation, comparisons and trip planning workspace.</Text><Link href="/travel-tools" className="mt-3 inline-flex text-sm font-bold text-accent-text underline">Explore all travel tools</Link></Container></Section><Section spacing="lg"><Container><TravelToolsDashboard/></Container></Section></>; }
