"use client";

import { useState } from "react";

export function SharePropertyButton({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} | Hotelnearby`, text: `View ${title} on Hotelnearby`, url });
        setMessage("Share options opened.");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Property link copied.");
      }
    } catch {
      setMessage("Sharing was cancelled or unavailable. You can copy the page address from your browser.");
    }
  }
  return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={share} className="inline-flex min-h-10 items-center rounded-lg border border-input-border px-3 text-sm font-bold hover:bg-surface-muted">Share listing ↗</button>{message ? <span role="status" className="text-xs text-muted-foreground">{message}</span> : null}</div>;
}
