import "@fontsource-variable/manrope";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/dm-serif-display";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { getPublicEnv } from "@/lib/env/public";
import { PlatformSupportWhatsApp } from "@/components/layout/platform-support-whatsapp";
import { SupportChatbot } from "@/features/support/support-chatbot";
import { SITE } from "@/lib/site";

export function generateMetadata(): Metadata {
  const { siteUrl, appEnv } = getPublicEnv();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
    description: SITE.description,
    openGraph: { type: "website", siteName: SITE.name, title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description, locale: "en_NG" },
    twitter: { card: "summary_large_image", title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description },
    // Only the real production site should be indexed. Dev and staging never are.
    robots:
      appEnv === "production" ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "all", color: "#F5F2EB" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme="light">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
          { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: getPublicEnv().siteUrl, description: SITE.description },
          { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: getPublicEnv().siteUrl, inLanguage: "en-NG" },
        ]).replace(/</g, "\\u003c") }} />
      </head>
      <body className="min-h-full">
        {children}
        <PlatformSupportWhatsApp />
        <SupportChatbot />
      </body>
    </html>
  );
}
