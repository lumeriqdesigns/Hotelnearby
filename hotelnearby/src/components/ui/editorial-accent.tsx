import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";

import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cn } from "@/lib/cn";

/**
 * DM Serif Display, for sparing editorial moments only: a pull quote, a journal
 * standfirst, one short phrase. Never for navigation, forms, prices, buttons or
 * running text. Its font files load only on pages that render this component.
 */
export function EditorialAccent({
  as,
  className,
  ...props
}: ComponentPropsWithoutRef<"p"> & { as?: ElementType }) {
  const Tag: ElementType = as ?? "p";
  return (
    <Tag
      className={cn("font-editorial text-h2 leading-snug font-normal tracking-normal", className)}
      {...props}
    />
  );
}
