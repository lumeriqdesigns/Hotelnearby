"use client";

import { useState } from "react";

import type { PropertyMedia } from "@/features/properties/types";

export function PropertyGallery({ media, propertyName }: { media: PropertyMedia[]; propertyName: string }) {
  const images = media.filter((item) => item.type === "image");
  const videos = media.filter((item) => item.type === "video");
  const [active, setActive] = useState(0);
  const current = images[active];
  const videoEmbed = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
      if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(parsed.hostname)) {
        const id = parsed.searchParams.get("v");
        if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
        if (parsed.pathname.startsWith("/embed/")) return `https://www.youtube-nocookie.com${parsed.pathname}`;
      }
      if (["vimeo.com", "www.vimeo.com"].includes(parsed.hostname)) {
        const id = parsed.pathname.split("/").filter(Boolean).at(-1);
        if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
      }
    } catch { return null; }
    return null;
  };

  return (
    <div className="grid gap-3">
      <div className="relative min-h-64 overflow-hidden rounded-2xl bg-surface-muted sm:min-h-[430px]">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={current.alt || `${propertyName} accommodation`} className="h-full min-h-64 w-full object-cover sm:min-h-[430px]" loading="eager" fetchPriority="high" decoding="async" />
        ) : (
          <div className="flex min-h-64 items-center justify-center text-6xl text-accent-text sm:min-h-[430px]" aria-label="No property images available">⌂</div>
        )}
        {current?.caption ? <p className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-sm text-white">{current.caption}</p> : null}
        {images.length > 1 ? <p className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-bold text-white">{active + 1} / {images.length}</p> : null}
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Property image gallery">
          {images.map((image, index) => (
            <button key={image.id} type="button" onClick={() => setActive(index)} aria-label={`Show image ${index + 1}`} aria-pressed={active === index} className={`overflow-hidden rounded-lg border-2 ${active === index ? "border-accent" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumbnail_url || image.url} alt={image.alt || `${propertyName} image ${index + 1}`} className="h-16 w-full object-cover sm:h-20" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}
      {videos.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {videos.map((video) => {
            const embed = videoEmbed(video.url);
            const isDirectVideo = /\.(mp4|webm|ogg)(?:$|\?)/i.test(video.url);
            return (
              <div key={video.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                {embed ? <iframe src={embed} title={video.caption || `${propertyName} video tour`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="aspect-video w-full" /> : isDirectVideo ? <video controls preload="metadata" poster={video.thumbnail_url || undefined} className="aspect-video w-full"><source src={video.url} /></video> : <a href={video.url} target="_blank" rel="noreferrer" className="flex min-h-16 items-center gap-3 p-3 text-sm font-bold hover:bg-surface-muted"><span className="flex size-10 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">▶</span><span>{video.caption || "Watch property video tour"}</span><span className="ml-auto text-muted-foreground" aria-hidden="true">↗</span></a>}
                {video.caption ? <p className="px-3 py-2 text-sm font-semibold">{video.caption}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
