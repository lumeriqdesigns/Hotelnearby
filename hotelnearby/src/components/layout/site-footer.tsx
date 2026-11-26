import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SITE } from "@/lib/site";

const footerGroups = [
  { title: "Explore", links: [
    { label: "Search accommodation", href: "/search" },
    { label: "Destinations", href: "/destinations" },
    { label: "Accommodation types", href: "/categories" },
    { label: "Nearby places", href: "/nearby" },
    { label: "Events", href: "/events" },
  ]},
  { title: "Get inspired", links: [
    { label: "Travel Journal", href: "/journal" },
    { label: "Travel tools", href: "/travel-tools" },
    { label: "About Hotelnearby", href: "/about" },
    { label: "Frequently asked questions", href: "/faq" },
  ]},
  { title: "For property owners", links: [
    { label: "List your property", href: "/providers/register" },
    { label: "Provider sign in", href: "/sign-in" },
  ]},
  { title: "Help & information", links: [
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ]},
];

export function SiteFooter() {
  return (
    <footer className="bg-[#14263e] text-white">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-11 sm:grid-cols-2 lg:grid-cols-[1.55fr_repeat(4,1fr)] lg:gap-8">
          <div className="max-w-sm">
            <Link href="/" className="inline-flex text-[1.7rem] font-extrabold tracking-[-.055em] text-white">{SITE.name}<span className="ml-1 mt-1.5 h-2 w-2 rounded-full bg-[#c9a66b]" /></Link>
            <p className="mt-4 text-sm leading-7 text-[#c2cbd7]">{SITE.description}</p>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[.16em] text-[#d9b77d]">{SITE.tagline}</p>
            <p className="mt-6 max-w-xs text-xs leading-6 text-[#9eacbd]">Discover accommodation with confidence. Connect directly with the people who manage each property.</p>
          </div>
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#d9b77d]">{group.title}</h2>
              <ul className="mt-5 space-y-3.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13px] text-[#c2cbd7] transition-colors hover:text-white hover:underline hover:underline-offset-4">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/15 pt-6 text-xs leading-5 text-[#9eacbd] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>Independent discovery. Contact each property directly. No accommodation bookings are processed here.</p>
        </div>
      </Container>
    </footer>
  );
}
