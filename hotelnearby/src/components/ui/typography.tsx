import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type HeadingSize = "display" | "h1" | "h2" | "h3" | "h4";

const sizeClass: Record<HeadingSize, string> = {
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-h4",
};

/**
 * Semantic level (`as`) and visual size (`size`) are separate on purpose, so the
 * document outline stays correct whatever the design needs.
 */
export function Heading({
  as: Tag = "h2",
  size,
  className,
  ...props
}: ComponentPropsWithoutRef<"h2"> & { as?: HeadingLevel; size?: HeadingSize }) {
  const fallback: HeadingSize =
    Tag === "h1" ? "h1" : Tag === "h2" ? "h2" : Tag === "h3" ? "h3" : "h4";
  return <Tag className={cn(sizeClass[size ?? fallback], "text-balance", className)} {...props} />;
}

const textSize = {
  "body-lg": "text-body-lg",
  body: "text-body",
  small: "text-small",
  caption: "text-caption",
} as const;

export function Text({
  as,
  size = "body",
  tone = "default",
  className,
  ...props
}: {
  as?: ElementType;
  size?: keyof typeof textSize;
  tone?: "default" | "muted";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"p">, "className" | "children">) {
  const Tag: ElementType = as ?? "p";
  return (
    <Tag
      className={cn(textSize[size], tone === "muted" && "text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Comfortable line length for long reading (about 65 characters). */
export function Prose({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("max-w-[65ch] [&>*+*]:mt-4", className)} {...props} />;
}
