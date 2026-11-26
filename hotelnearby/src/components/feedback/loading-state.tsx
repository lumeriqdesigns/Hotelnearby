import { Container } from "@/components/ui/container";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

export { Spinner };

/** Accessible loading indicator for a whole page or section. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <Container
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 py-16 text-muted-foreground"
    >
      <Spinner className="text-primary" />
      <span>{label}…</span>
    </Container>
  );
}

/** Placeholder block that reserves space while content loads. Decorative. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
    />
  );
}
