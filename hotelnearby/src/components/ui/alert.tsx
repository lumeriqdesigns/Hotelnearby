import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon } from "./icons";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const styles: Record<AlertVariant, string> = {
  info: "border-info-border bg-info-bg text-info-fg",
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
};

const icons = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: AlertTriangleIcon,
  danger: AlertCircleIcon,
} as const;

/**
 * Inline message. Warnings and errors use role="alert" (announced immediately),
 * info and success use role="status" (announced politely). An icon and a title
 * carry the meaning, so colour is never the only cue.
 */
export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border p-4", styles[variant], className)}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-bold">{title}</p>
        {children ? <div className="text-small text-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
