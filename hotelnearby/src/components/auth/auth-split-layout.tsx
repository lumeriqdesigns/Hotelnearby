import type { ReactNode } from "react";
import Link from "next/link";

/** Shared, responsive hospitality-led frame for sign-in and account onboarding. */
export function AuthSplitLayout({ children, eyebrow = "HOTELNEARBY", title = "A better stay starts here." }: { children: ReactNode; eyebrow?: string; title?: string }) {
  return (
    <main className="grid min-h-[100svh] bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(440px,1.08fr)]">
      <aside className="relative isolate block min-h-[220px] overflow-hidden bg-slate-950 sm:min-h-[260px] lg:min-h-[100svh]">
        <div className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(180deg,rgba(5,18,24,.12),rgba(5,18,24,.76)),url('/images/homepage-hero.webp')" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/15 via-transparent to-slate-950/45" />
        <div className="flex min-h-[220px] flex-col justify-between p-6 sm:min-h-[260px] sm:p-8 lg:min-h-[100svh] lg:p-10 xl:p-14">
          <Link href="/" className="w-fit text-sm font-extrabold tracking-[.2em] text-white">{eyebrow}</Link>
          <div className="max-w-xl pb-1 text-white lg:pb-8">
            <p className="mb-3 text-[10px] font-bold tracking-[.32em] text-white/80 sm:mb-5 sm:text-xs">GUIDE &amp; DESIGN</p>
            <h1 className="max-w-lg text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl lg:text-4xl xl:text-6xl">{title}</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/80 sm:mt-5 sm:text-base sm:leading-7">Discover welcoming places, manage your bookings and make every journey count.</p>
          </div>
          <p className="mt-4 hidden text-xs tracking-wide text-white/65 lg:block">Find your place. Make it memorable.</p>
        </div>
      </aside>
      <section className="flex min-h-[100svh] items-center justify-center px-5 py-10 sm:px-10 lg:px-12 xl:px-16">
        <div className="w-full max-w-[520px]">
          
          {children}
        </div>
      </section>
    </main>
  );
}
