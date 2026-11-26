import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/cn";

const widths = {
  narrow: "max-w-narrow",
  default: "max-w-page",
  wide: "max-w-wide",
} as const;

/** Centred, responsive content column with consistent side gutters. */
export function Container({
  as: Tag = "div",
  size = "default",
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { as?: ElementType; size?: keyof typeof widths }) {
  return (
    <Tag
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[size], className)}
      {...props}
    />
  );
}

const tones = {
  default: "bg-background text-foreground",
  muted: "bg-surface-muted text-foreground",
  brand: "bg-brand-surface text-brand-surface-foreground",
} as const;

const spacing = {
  sm: "py-8 sm:py-10",
  md: "py-12 sm:py-16",
  lg: "py-16 sm:py-24",
} as const;

/** Full-width band with vertical rhythm. Put a Container inside it. */
export function Section({
  tone = "default",
  spacing: space = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  tone?: keyof typeof tones;
  spacing?: keyof typeof spacing;
}) {
  return <section className={cn(tones[tone], spacing[space], className)} {...props} />;
}
