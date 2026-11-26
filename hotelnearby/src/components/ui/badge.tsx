import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

export type BadgeVariant =
  "neutral" | "brand" | "featured" | "success" | "warning" | "danger" | "info";

const variants: Record<BadgeVariant, string> = {
  neutral: "border-border bg-surface-muted text-foreground",
  brand: "border-transparent bg-primary text-primary-foreground",
  featured: "border-transparent bg-accent text-accent-foreground",
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
};

/**
 * Small status label. Meaning must come from the words, never from colour alone.
 * Paid placements use "featured" and must always carry a word such as "Sponsored".
 * A paid plan never implies "Verified".
 */
export function Badge({
  variant = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-bold whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
