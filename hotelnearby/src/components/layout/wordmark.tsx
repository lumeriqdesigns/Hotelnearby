import Link from "next/link";

import { cn } from "@/lib/cn";
import { SITE } from "@/lib/site";

/**
 * TEMPORARY text-based wordmark. The approved rising-horizon Hotelnearby logo has
 * not been supplied. Replace this component's contents when the artwork arrives.
 * Do not treat this as the brand logo.
 */
export function Wordmark({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const classes = cn("text-primary text-[1.35rem] font-extrabold tracking-[-0.045em]", className);
  if (!asLink) return <span className={classes}>{SITE.name}</span>;
  return (
    <Link href="/" aria-label={`${SITE.name} home`} className={classes} data-temporary-wordmark="">
      {SITE.name}
    </Link>
  );
}
