import { cn } from "@/lib/cn";

/** Decorative spinner. Pair it with text or an aria-live region that says what is loading. */
export function Spinner({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current",
        className,
      )}
    />
  );
}
