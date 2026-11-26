"use client";

import { usePathname } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { CloseIcon, MenuIcon } from "./icons";
import { NavLink } from "./nav-link";

export type NavItem = { label: string; href: string };

/**
 * Disclosure-style menu for small screens. The panel is a real <nav>, opens on
 * the button, closes with Escape (focus returns to the button) and closes
 * itself when the route changes. Hide it from md up with a wrapper class.
 */
export function MobileNav({ items, label = "Main" }: { items: NavItem[]; label?: string }) {
  const pathname = usePathname();
  // Open state is tied to the path it was opened on, so navigating closes it
  // without needing an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      setOpenPath(null);
      buttonRef.current?.focus();
    }
  }

  return (
    <div onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenPath(open ? null : pathname)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-bold hover:bg-surface-muted"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
        <span>Menu</span>
      </button>
      <nav
        id={panelId}
        aria-label={label}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 border-b bg-surface p-3 shadow-overlay"
      >
        <ul className="mx-auto flex max-w-page flex-col gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className="w-full">
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
