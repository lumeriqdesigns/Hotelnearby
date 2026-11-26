"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be blocked. The choice still applies for this page view.
  }
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

const options: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: "system", label: "Use device theme", Icon: MonitorIcon },
  { value: "light", label: "Use light theme", Icon: SunIcon },
  { value: "dark", label: "Use dark theme", Icon: MoonIcon },
];

/** Three-way theme control: device, light or dark. The choice is remembered on this device. */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn("inline-flex rounded-md border bg-surface-muted p-0.5", className)}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={preference === value}
          onClick={() => applyPreference(value)}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-sm transition-colors",
            preference === value
              ? "bg-surface text-primary shadow-raised"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  );
}
