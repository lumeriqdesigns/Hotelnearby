import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformRoles } from "@/features/auth/authorization";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requirePlatformRoles(["administrator", "editor_moderator"]);
  const displayName = profile.full_name || profile.email || "Administrator";
  return <div className="admin-workspace min-h-screen lg:grid lg:grid-cols-[278px_minmax(0,1fr)]">
    <AdminSidebar name={displayName} />
    <div className="min-w-0">
      <header className="admin-topbar hotel-glass-nav sticky top-0 z-30 flex min-h-[70px] items-center justify-between gap-3 border-b border-white/60 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-accent-text">Hotelnearby · Administration</p><p className="truncate text-sm font-bold">Good day, {profile.full_name?.split(" ")[0] || "Administrator"}</p></div>
        <div className="flex shrink-0 items-center gap-2"><Link href="/admin/audit" className="hidden min-h-10 items-center rounded-full border border-input-border bg-white/70 px-4 text-xs font-bold sm:inline-flex">Activity log</Link><Link href="/account/profile" aria-label="Account settings" className="grid size-10 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">{displayName.trim().charAt(0).toUpperCase()}</Link></div>
      </header>
      <main className="admin-main min-w-0 px-3 py-5 sm:px-5 sm:py-7 lg:px-8">{children}</main>
      <footer className="border-t border-border/70 px-5 py-5 text-center text-xs text-muted-foreground">Hotelnearby Administration · Secure platform operations</footer>
    </div>
  </div>;
}
