"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  { title: "Platform", links: [["Overview", "/admin", "⌂"], ["Users", "/admin/users", "♙"], ["Provider organisations", "/admin/organisations", "▦"], ["Property moderation", "/admin/properties", "⌂"], ["Trust & safety", "/admin/trust", "✧"]] },
  { title: "Discovery & growth", links: [["Destinations", "/admin/destinations", "⌖"], ["Promotions", "/admin/promotions", "✳"], ["Events", "/admin/events", "◇"], ["Nearby directory", "/admin/nearby-directory", "◎"]] },
  { title: "Business & content", links: [["Billing", "/admin/billing", "₦"], ["Refunds", "/admin/refunds", "↩"], ["Travel Journal", "/admin/travel-journal", "▤"]] },
  { title: "Operations", links: [["Support inbox", "/admin/support", "✉"], ["AI usage", "/admin/ai-usage", "✳"], ["Audit logs", "/admin/audit", "≋"], ["Permissions", "/admin/permissions", "⚿"]] },
] as const;

export function AdminSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  return <aside className="admin-sidebar relative flex min-w-0 flex-col overflow-hidden px-5 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:px-6 lg:py-8">
    <div className="admin-sidebar-image" aria-hidden="true" />
    <div className="relative z-10 flex items-center justify-between gap-2">
      <Link href="/admin" className="text-lg font-black tracking-tight text-white">hotelnearby<span className="text-[#e7c99c]">.</span></Link>
      <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest text-white/80">Admin</span>
    </div>
    <div className="relative z-10 mt-9 max-w-[220px]">
      <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#e6c99c]">The control room</p>
      <h2 className="mt-3 font-serif text-[2rem] leading-[1.12] tracking-tight">Where hospitality meets control.</h2>
      <p className="mt-3 text-sm leading-6 text-white/75">A clearer view of the people, places and experiences across Hotelnearby.</p>
    </div>
    <nav aria-label="Administration navigation" className="admin-sidebar-nav relative z-10 mt-8 grid gap-5">
      {groups.map((group) => <section key={group.title}>
        <h3 className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-white/50">{group.title}</h3>
        <ul className="grid gap-1">{group.links.map(([label, href, icon]) => {
          const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return <li key={href}><Link href={href} aria-current={active ? "page" : undefined} className={`admin-nav-link flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${active ? "bg-white/20 text-white shadow-inner" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-sm">{icon}</span>{label}</Link></li>;
        })}</ul>
      </section>)}
    </nav>
    <div className="relative z-10 mt-auto hidden rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl lg:block">
      <p className="text-xs font-bold text-white">Signed in as</p>
      <p className="mt-1 truncate text-sm text-white/80">{name}</p>
      <p className="mt-3 text-[10px] leading-5 text-white/55">Administrator access is monitored and recorded.</p>
    </div>
  </aside>;
}
