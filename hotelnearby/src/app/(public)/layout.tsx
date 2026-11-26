import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

/** Public-facing pages share the hospitality storefront shell. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
