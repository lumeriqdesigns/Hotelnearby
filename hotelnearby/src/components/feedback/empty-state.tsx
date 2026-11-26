import type { ReactNode } from "react";

import { Heading } from "@/components/ui/typography";

/** Honest empty state. Never fills the gap with made-up records. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-input-border bg-surface p-8">
      <Heading as="h2" size="h4">
        {title}
      </Heading>
      {children ? <p className="max-w-prose text-muted-foreground">{children}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
