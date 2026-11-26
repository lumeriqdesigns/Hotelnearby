"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button";
import { ChevronDownIcon } from "./icons";

export type MenuItem =
  | { kind: "link"; label: string; href: string; disabled?: boolean }
  | {
      kind: "action";
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      tone?: "default" | "danger";
    }
  | { kind: "separator" };

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

const itemClass =
  "flex min-h-10 w-full items-center rounded-sm px-3 text-left text-small font-semibold text-foreground hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-offset-[-3px] aria-disabled:opacity-50";

/**
 * Menu button following the WAI-ARIA menu pattern.
 * Trigger: Enter, Space or Arrow keys open it. Menu: Arrow Up/Down and Home/End
 * move, a typed letter jumps, Escape closes and returns focus, Tab closes.
 */
export function DropdownMenu({
  label,
  items,
  align = "start",
  variant = "secondary",
  size = "md",
}: {
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [open, setOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"first" | "last">("first");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function getItems(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const available = getItems();
    (focusTarget === "last" ? available.at(-1) : available[0])?.focus();
  }, [open, focusTarget]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusTarget(event.key === "ArrowUp" ? "last" : "first");
      setOpen(true);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const available = getItems();
    const index = available.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        available[(index + 1) % available.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        available[(index - 1 + available.length) % available.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        available[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        available.at(-1)?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default: {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const typed = event.key.toLowerCase();
          const ordered = [...available.slice(index + 1), ...available.slice(0, index + 1)];
          ordered.find((el) => el.textContent?.trim().toLowerCase().startsWith(typed))?.focus();
        }
      }
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setFocusTarget("first");
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
        className={buttonStyles({ variant, size })}
      >
        {label}
        <ChevronDownIcon size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-30 mt-2 min-w-56 rounded-md border bg-surface p-1 shadow-overlay",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => {
            if (item.kind === "separator") {
              return <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-border" />;
            }
            if (item.kind === "link") {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => close(false)}
                  className={itemClass}
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return;
                  close(true);
                  item.onSelect();
                }}
                className={cn(itemClass, item.tone === "danger" && "text-danger-fg")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
