import Link from "next/link";

import { Container } from "@/components/ui/container";
import { MobileNav, type NavItem } from "@/components/ui/mobile-nav";
import { NavLink } from "@/components/ui/nav-link";

import { Wordmark } from "./wordmark";

const primaryLinks: NavItem[] = [
  { label: "Destinations", href: "/destinations" },
  { label: "Stays", href: "/categories" },
  { label: "Nearby", href: "/nearby" },
  { label: "Journal", href: "/journal" },
];

export function SiteHeader() {
  return (
    <header className="hotel-glass-nav sticky top-0 z-40 border-b border-[#e8e4dc] shadow-[0_5px_24px_-20px_rgba(23,43,70,.35)]">
      <div className="hidden border-b border-[#eeeae2] bg-[#f7f4ed] sm:block">
        <Container className="flex min-h-8 items-center justify-between gap-4 text-[11px] font-semibold tracking-wide text-[#687384]">
          <p>Discover independent places to stay across Nigeria</p>
          <p className="text-[#8a6b3c]">Explore well. Stay your way.</p>
        </Container>
      </div>
      <Container className="relative flex min-h-[76px] items-center justify-between gap-3 py-3">
        <div className="shrink-0"><Wordmark className="text-[1.45rem]" /></div>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
          {primaryLinks.map((item) => (
            <NavLink key={item.href} href={item.href} className="rounded-full px-4 py-2 text-[13px] font-bold text-[#536174] hover:bg-[#f1eee7] hover:text-[#172b46]">{item.label}</NavLink>
          ))}
          <NavLink href="/events" className="rounded-full px-4 py-2 text-[13px] font-bold text-[#536174] hover:bg-[#f1eee7] hover:text-[#172b46]">Events</NavLink>
        </nav>
        <div className="hidden items-center gap-2 xl:flex">
          <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9dce1] bg-white px-4 text-sm font-bold text-[#26364b] transition hover:border-[#b9a17a] hover:bg-[#faf8f3]">
            <span aria-hidden="true" className="text-base">⌕</span> Search stays
          </Link>
          <Link href="/providers/register" className="inline-flex min-h-11 items-center rounded-full bg-[#172b46] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#263f60]">
            List your property <span aria-hidden="true" className="ml-2">↗</span>
          </Link>
          <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-[#536174] transition hover:bg-[#f1eee7] hover:text-[#172b46]">Sign in</Link>
        </div>
        <div className="flex items-center gap-2 xl:hidden">
          <Link href="/search" aria-label="Search accommodation" className="inline-flex min-h-10 items-center rounded-full border border-[#d9dce1] px-3 text-sm font-bold text-[#172b46]">⌕ <span className="ml-1 hidden sm:inline">Search</span></Link>
          <MobileNav items={[
            ...primaryLinks,
            { label: "Events", href: "/events" },
            { label: "Plan a trip", href: "/travel-tools" },
            { label: "Search accommodation", href: "/search" },
            { label: "My travel", href: "/my-travel" },
            { label: "List your property", href: "/providers/register" },
            { label: "Sign in", href: "/sign-in" },
          ]} />
        </div>
      </Container>
    </header>
  );
}
