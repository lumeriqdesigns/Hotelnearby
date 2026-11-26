import Link from "next/link";
import { requirePlatformRoles } from "@/features/auth/authorization";

export const metadata = { title: "Administrator overview | Hotelnearby", robots: { index: false, follow: false } };

function Metric({ label, value, href, detail, icon }: { label: string; value: number | null; href: string; detail: string; icon: string }) {
  return <Link href={href} className="admin-metric-card hotel-bento-card group p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-muted-foreground">{label}</p><span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-[#f2eee6] text-lg text-[#8a6c42]">{icon}</span></div>
    <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">{value === null ? "—" : value.toLocaleString("en-NG")}</p>
    <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{detail}</p><span aria-hidden="true" className="text-sm font-bold text-accent-text transition group-hover:translate-x-1">↗</span></div>
  </Link>;
}

const shortcuts = [
  { title: "Review properties", description: "Approve listings, request corrections and manage property status.", href: "/admin/properties", icon: "⌂" },
  { title: "Manage users", description: "Review accounts, access roles and account standing.", href: "/admin/users", icon: "♙" },
  { title: "Provider organisations", description: "Oversee partner organisations and membership status.", href: "/admin/organisations", icon: "▦" },
  { title: "Trust & safety", description: "Handle verification, reviews and reported content.", href: "/admin/trust", icon: "✧" },
  { title: "Payments & refunds", description: "Review platform billing activity and refund requests.", href: "/admin/billing", icon: "₦" },
  { title: "Support inbox", description: "Follow up on questions and platform support requests.", href: "/admin/support", icon: "✉" },
];

export default async function AdminOverviewPage() {
  const { supabase } = await requirePlatformRoles(["administrator"]);
  const [users, organisations, properties, pending, approved, suspended, aiUsage, audit] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("provider_organisations").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("approval_status", "pending_review"),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "suspended"),
    supabase.from("ai_listing_usage").select("request_count,input_characters,output_tokens").eq("usage_date", new Date().toISOString().slice(0, 10)),
    supabase.from("admin_audit_logs").select("id,action,target_type,target_id,created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  const usageRows = aiUsage.error ? null : aiUsage.data;
  const usageTotal = usageRows?.reduce((sum, row) => sum + row.request_count, 0) ?? null;
  const metrics = [
    { label: "Registered users", value: users.error ? null : users.count, href: "/admin/users", detail: "Accounts on the platform", icon: "♙" },
    { label: "Provider organisations", value: organisations.error ? null : organisations.count, href: "/admin/organisations", detail: "Hospitality partners", icon: "▦" },
    { label: "All properties", value: properties.error ? null : properties.count, href: "/admin/properties", detail: "Listings in the catalogue", icon: "⌂" },
    { label: "Awaiting review", value: pending.error ? null : pending.count, href: "/admin/properties", detail: "Listings pending moderation", icon: "◷" },
    { label: "Approved listings", value: approved.error ? null : approved.count, href: "/admin/properties", detail: "Approved for discovery", icon: "✓" },
    { label: "Suspended accounts", value: suspended.error ? null : suspended.count, href: "/admin/users", detail: "Accounts needing attention", icon: "!" },
  ];
  return <div className="admin-dashboard hotel-dashboard-shell space-y-7 rounded-[1.7rem] p-3 sm:p-5 lg:p-6">
    <section className="admin-welcome relative isolate overflow-hidden rounded-[1.5rem] p-6 text-white sm:p-8 lg:p-10">
      <div className="admin-welcome-image" aria-hidden="true" />
      <div className="relative z-10 max-w-2xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#f0d5ad]">Your platform at a glance</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">The bigger picture,<br className="hidden sm:block"/> all in one place.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Monitor the Hotelnearby ecosystem, support hospitality partners and keep the platform running smoothly.</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/properties" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-xs font-extrabold text-[#172b40] transition hover:bg-[#f1dfc5]">Review properties <span className="ml-2">↗</span></Link><Link href="/admin/audit" className="inline-flex min-h-11 items-center rounded-full border border-white/30 bg-white/10 px-5 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20">View activity log</Link></div>
      </div>
      <div className="relative z-10 mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-4 text-xs text-white/70 sm:absolute sm:bottom-8 sm:right-8 sm:mt-0 sm:border-0 sm:pt-0"><span>Secure operations</span><span>Role-protected access</span><span>Audited actions</span></div>
    </section>

    <section className="space-y-3"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-accent-text">Platform health</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">Key numbers</h2></div><p className="text-xs text-muted-foreground">Live database counts · unavailable data is shown as —</p></div>
      <div className="admin-metrics-grid grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div>
    </section>

    <section className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <article className="hotel-bento-card p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-accent-text">Operations</p><h2 className="mt-1 text-lg font-extrabold">Daily AI Listing Guide usage</h2></div><span className="grid size-10 place-items-center rounded-xl bg-[#f2eee6] text-lg text-[#8a6c42]">✳</span></div><p className="mt-5 text-4xl font-extrabold tabular-nums">{usageTotal === null ? "—" : usageTotal.toLocaleString("en-NG")}</p><p className="mt-1 text-sm text-muted-foreground">Generation requests recorded for the current UTC date.</p><Link className="mt-5 inline-flex text-xs font-extrabold text-accent-text underline underline-offset-4" href="/admin/ai-usage">Explore AI usage →</Link></article>
      <article className="hotel-bento-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-accent-text">Accountability</p><h2 className="mt-1 text-lg font-extrabold">Recent admin activity</h2></div><Link href="/admin/audit" className="text-xs font-extrabold text-accent-text underline underline-offset-4">Full log</Link></div>{audit.error ? <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Audit data is unavailable. Confirm the audit-log migration and database permissions.</p> : audit.data?.length ? <ul className="mt-4 divide-y divide-border">{audit.data.map((item) => <li key={item.id} className="flex items-start gap-3 py-3"><span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-muted text-xs">↗</span><div className="min-w-0"><p className="break-words text-sm font-bold">{item.action.replaceAll("_", " ")}</p><p className="mt-0.5 break-all text-xs text-muted-foreground">{item.target_type} · {item.target_id ?? "No target ID"}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString("en-NG")}</p></div></li>)}</ul> : <p className="mt-5 text-sm text-muted-foreground">No administrator actions have been recorded yet.</p>}</article>
    </section>

    <section className="space-y-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-accent-text">Quick access</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">Keep things moving</h2></div><div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{shortcuts.map((item) => <Link key={item.href} href={item.href} className="hotel-bento-card group flex min-w-0 items-start gap-4 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f2eee6] text-lg text-[#8a6c42]">{item.icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span><span className="mt-3 block text-xs font-extrabold text-accent-text">Open workspace ↗</span></span></Link>)}</div></section>
    <p className="rounded-xl border border-border/70 bg-white/55 px-4 py-3 text-xs leading-5 text-muted-foreground">Hotelnearby processes provider subscription and promotion payments only; guest accommodation payments are not collected by the platform.</p>
  </div>;
}
