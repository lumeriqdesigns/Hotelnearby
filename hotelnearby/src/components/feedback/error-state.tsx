"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";

import { StatePanel } from "./state-panel";

type ErrorStateProps = {
  error: unknown;
  retry: () => void;
  title?: string;
};

/**
 * Reusable body for every `error.tsx` boundary. Shows a safe message and a
 * reference code (the server log digest) so support can find the real error.
 */
export function ErrorState({ error, retry, title = "Something went wrong" }: ErrorStateProps) {
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  useEffect(() => {
    console.error("Route error", { digest });
  }, [digest]);

  return (
    <StatePanel
      tone="error"
      title={title}
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Go to the homepage
          </ButtonLink>
        </>
      }
    >
      <p>
        We could not load this page. Try again, and if it keeps happening, contact support
        {digest ? ` and quote reference ${digest}` : ""}.
      </p>
    </StatePanel>
  );
}
