"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CloseIcon } from "./icons";
import { Heading } from "./typography";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Action buttons, shown in a footer row. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal dialog built on the native <dialog> element, so the browser provides the
 * focus trap, Escape to close, inert background and focus return to the opener.
 * Controlled: the parent owns `open` and must clear it in `onClose`.
 * By default focus starts on the first control (the Close button). Add
 * `data-autofocus` to a field to start there instead.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Prefer a marked field over the Close button, so typing can start straight away.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop targets the <dialog> itself, not its content.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-surface p-0 text-foreground shadow-overlay backdrop:bg-overlay",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Heading as="h2" size="h3" id={titleId}>
              {title}
            </Heading>
            {description ? (
              <p id={descriptionId} className="text-small text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mt-1 -mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-surface-muted"
          >
            <CloseIcon />
          </button>
        </div>
        {children ? <div>{children}</div> : null}
        {footer ? <div className="flex flex-wrap justify-end gap-3 pt-2">{footer}</div> : null}
      </div>
    </dialog>
  );
}
