"use client";
import { useEffect, useRef } from "react";
export function PromotionImpression({ promotionId }: { promotionId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    let sent = false;
    const observer = new IntersectionObserver((entries) => {
      if (sent && entries.some((entry) => entry.isIntersecting)) return;
      if (entries.some((entry) => entry.isIntersecting)) {
        sent = true; observer.disconnect();
        void fetch("/api/promotions/impression", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promotionId }), keepalive: true }).catch(() => undefined);
      }
    }, { threshold: 0.5 });
    observer.observe(node); return () => observer.disconnect();
  }, [promotionId]);
  return <span ref={ref} aria-hidden="true" className="sr-only" />;
}
