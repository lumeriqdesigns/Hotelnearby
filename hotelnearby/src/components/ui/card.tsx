import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Heading, type HeadingLevel } from "./typography";

type CardProps<T extends ElementType> = {
  as?: T;
  /** Adds hover and focus-within styling. Use with a "stretched link" in the title. */
  interactive?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Card<T extends ElementType = "div">({
  as,
  interactive = false,
  className,
  ...props
}: CardProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cn(
        "hotel-bento-card relative flex flex-col overflow-hidden",
        interactive &&
          "transition-colors focus-within:border-input-border hover:border-input-border",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("flex flex-1 flex-col gap-2 p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t bg-surface-muted/60 px-5 py-3", className)}
      {...props}
    />
  );
}

/**
 * Card heading. For a clickable card, put the link INSIDE the title and give it
 * `after:absolute after:inset-0` so the whole card is one tab stop.
 */
export function CardTitle({
  as = "h3",
  className,
  children,
}: {
  as?: HeadingLevel;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Heading as={as} size="h4" className={className}>
      {children}
    </Heading>
  );
}
