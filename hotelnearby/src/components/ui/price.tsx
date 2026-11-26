import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/format";

/**
 * Price with its basis. Amounts are integer kobo. Always show the approved price
 * disclaimer (SITE.priceDisclaimer) near any price a visitor sees.
 */
export function Price({
  kobo,
  basis,
  className,
}: {
  kobo: number;
  /** For example "per night". */
  basis?: string;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className="text-h3 font-extrabold tabular-nums">{formatNaira(kobo)}</span>
      {basis ? <span className="text-small text-muted-foreground">{basis}</span> : null}
    </p>
  );
}
