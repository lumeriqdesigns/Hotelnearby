"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

/**
 * Navigation link that marks the current page with aria-current="page".
 * The current page is also shown with a filled background, never colour alone.
 */
export function NavLink({
  href,
  exact = false,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string; exact?: boolean }) {
  const pathname = usePathname();
  const isCurrent = exact || href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-md px-3 font-semibold transition-colors hover:bg-surface-muted aria-[current=page]:bg-surface-muted aria-[current=page]:font-extrabold aria-[current=page]:text-primary",
        className,
      )}
      {...props}
    />
  );
}
