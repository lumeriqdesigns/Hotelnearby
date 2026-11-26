import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env/public";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl, appEnv } = getPublicEnv();
  if (appEnv !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/properties/", "/destinations/", "/accommodation/", "/journal/", "/nearby/", "/events/"], disallow: ["/admin/", "/dashboard/", "/account/", "/sign-in", "/register", "/forgot-password", "/search", "/my-travel", "/travel-tools", "/api/", "/auth/", "/provider-invitation/", "/journal/preview/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
