import type { ReactNode } from "react";

import { Heading } from "@/components/ui/typography";
import { cn } from "@/lib/cn";

/** Shared layout for error, not-found and empty states. */
export function StatePanel({
  title,
  children,
  actions,
  tone = "neutral",
  className,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "neutral" | "error";
  className?: string;
}) {
  return (
    <section
      role={tone === "error" ? "alert" : undefined}
      className={cn("mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-20 sm:px-6", className)}
    >
      <Heading as="h1" size="h1">
        {title}
      </Heading>
      {children ? <div className="leading-relaxed text-muted-foreground">{children}</div> : null}
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}
