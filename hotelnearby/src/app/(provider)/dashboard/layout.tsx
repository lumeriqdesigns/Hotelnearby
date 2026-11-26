import type { ReactNode } from "react";
import Link from "next/link";

import { requirePlatformRoles } from "@/features/auth/authorization";
import { Wordmark } from "@/components/layout/wordmark";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "⌂", exact: true },
  { href: "/dashboard#properties", label: "My properties", icon: "▦" },
  { href: "/dashboard#enquiries", label: "Guest enquiries", icon: "✉" },
  { href: "/dashboard/trust", label: "Trust & reviews", icon: "✧" },
  { href: "/dashboard/ai-listing", label: "Listing assistant", icon: "✳" },
  { href: "/dashboard#organisation-settings", label: "Team & organisation", icon: "♙" },
];

export default async function ProviderDashboardLayout({ children }: { children: ReactNode }) {
  const { profile } = await requirePlatformRoles(["provider_owner", "provider_staff"]);
  return (
    <div className="hotel-dashboard-shell min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="provider-sidebar relative flex flex-col overflow-hidden px-5 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:px-6 lg:py-8">
        <div className="provider-sidebar-image" aria-hidden="true" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <Wordmark className="text-white" />
          <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/85">Partner</span>
        </div>
        <div className="relative z-10 mt-9 max-w-[210px]">
          <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#e6c99c]">Hotelnearby partners</p>
          <h2 className="mt-3 font-serif text-[2rem] leading-[1.12] tracking-tight">Make every stay count.</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">Your hospitality business, thoughtfully managed in one place.</p>
        </div>
        <nav aria-label="Provider navigation" className="relative z-10 mt-9 grid gap-1.5">
          <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.2em] text-white/55">Workspace</p>
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="provider-nav-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/85 transition hover:bg-white/15 hover:text-white">
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-white/10 text-base">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="relative z-10 mt-auto hidden rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl lg:block">
          <p className="text-xs font-bold text-white">Need a hand?</p>
          <p className="mt-1 text-xs leading-5 text-white/70">Our support team is here to help you manage your listing.</p>
          <Link href="/contact" className="mt-3 inline-flex text-xs font-extrabold text-[#f1d6ad] underline underline-offset-4">Contact support</Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="provider-topbar hotel-glass-nav sticky top-0 z-30 flex min-h-[68px] items-center justify-between gap-3 border-b border-white/60 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-accent-text">Provider workspace</p><p className="truncate text-sm font-bold">Welcome back, {profile.full_name || "partner"}</p></div>
          <div className="flex shrink-0 items-center gap-2"><Link href="/dashboard/billing" className="inline-flex min-h-10 items-center rounded-full border border-input-border bg-white/70 px-3 text-xs font-bold sm:px-4">Billing</Link><Link href="/account/profile" aria-label="Account settings" className="grid size-10 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{(profile.full_name || "P").trim().charAt(0).toUpperCase()}</Link></div>
        </header>
        <main className="min-w-0">{children}</main>
        <footer className="border-t border-border/70 px-5 py-5 text-center text-xs text-muted-foreground">Hotelnearby Partner Workspace · Built for better stays and stronger hospitality businesses.</footer>
      </div>
    </div>
  );
}
