# Hotelnearby technical SEO audit and implementation

**Audit type:** source-code / architecture audit of the supplied project ZIP  
**Audit date:** 25 November 2026  
**Scope:** Next.js App Router, public route metadata, crawl controls, sitemap, structured data, property and destination discovery, images, internal linking and deployment readiness.

> This is not a live-site crawl, Search Console audit, Lighthouse run or field Core Web Vitals report. The production hostname, deployed response headers, live listing inventory and real-user performance data were not available during this implementation. Findings below distinguish code-level changes from items that require a deployed environment.

## Executive summary

The application already renders its main public pages on the server and reads public property and destination records from Supabase. The implementation strengthens that foundation with explicit crawl rules, a database-backed sitemap, crawlable accommodation landing pages for Ilorin and Kwara, canonical metadata, social metadata and JSON-LD. The key anti-thin-content safeguards are explicit: Ilorin/Kwara category pages are `noindex` until at least three matching listings have meaningful descriptions (80+ characters) plus an image or sufficient amenity/feature detail; individual property pages use the same content-quality gate before indexing and sitemap inclusion.

## Implemented

| Area | Change |
|---|---|
| Rendering | Public App Router pages remain server-rendered; the new accommodation landing pages use server-side Supabase reads and revalidation. |
| Robots | Added `src/app/robots.ts`; production permits public property, destination, journal, nearby and event routes while excluding private/account, dashboard, API, search/filter and preview routes. Non-production blocks crawling. |
| XML sitemap | Reworked `src/app/sitemap.ts`; includes public static routes, approved property records, published destination routes, published journal articles/categories, verified nearby places/events, and Ilorin/Kwara category pages only when they have at least three matching records. Sitemap refreshes hourly. |
| Canonicals | Root canonical defaults to `/`; property and new accommodation routes declare canonical paths; existing destination, journal and nearby routes retain their canonical declarations. |
| Metadata | Root Open Graph/Twitter defaults; property metadata now includes a concise description, canonical, OG title/description/image and Twitter card. New landing pages generate location/category-specific metadata. |
| Structured data | Organization and WebSite JSON-LD at root; BreadcrumbList on reusable breadcrumb UI; LodgingBusiness JSON-LD on public property detail pages; FAQPage JSON-LD mirrors visible FAQ content. No aggregate rating or fabricated offer/availability schema is emitted. |
| Ilorin / Kwara SEO | Added `/accommodation/ilorin/{hotels,shortlets,serviced-apartments}` and matching Kwara routes. Content comes from `public_property_search`; zero-result pages explicitly explain the inventory gap and remain noindex. |
| Internal links | Added homepage links to priority Ilorin and Kwara accommodation categories; landing pages link to destination, search and provider routes. |
| Images | Property gallery primary image is eager/high priority with async decoding; thumbnails remain lazy with async decoding. New category cards use descriptive alt text and lazy loading. Existing provider-supplied image alt text remains preferred. |
| Mobile/performance | Existing responsive layout retained; database-backed pages use short revalidation windows; sitemap is cached hourly; non-critical gallery images lazy-load. |

## Priority SEO architecture

1. Homepage: broad Nigeria accommodation discovery, with clear Ilorin/Kwara links.
2. Ilorin category pages: hotels, shortlets and serviced apartments. These become indexable only with a useful minimum inventory.
3. Kwara category pages: same three categories, scoped to Kwara State.
4. Property detail pages: canonical `/properties/{slug}` pages sourced from approved active listings, with indexing withheld for thin descriptions or incomplete supporting content.
5. Destination guides: `/destinations/{slug}` pages index only when the destination record is published under existing editorial governance.
6. Journal and verified local discovery: published editorial and verified nearby/event records only.

## Audit findings and remaining risks

| Priority | Finding / risk | Required follow-up |
|---|---|---|
| Critical before launch | `NEXT_PUBLIC_SITE_URL` must be the final HTTPS production origin. Canonicals, robots sitemap URL, JSON-LD and sitemap host depend on it. | Set it in Vercel Production and redeploy. Do not point it at preview or localhost. |
| High | No live inventory count was available during this code audit. The new category pages may correctly remain noindex and absent from the sitemap until the database has at least three approved records per category/location. | Verify live approved listing counts; do not relax the threshold just to force indexing. |
| High | The property sitemap query is capped at 10,000 rows. | If the approved inventory grows beyond 10,000, implement sitemap index/chunked sitemap routes and page through the view. |
| High | Image URLs are externally supplied HTTPS URLs. The gallery uses native image elements rather than Next Image because arbitrary provider image hosts are not safely allowlisted in the current Next config. | Prefer a controlled image proxy/CDN or allowlist the actual Supabase Storage/image host, then migrate key images to `next/image` with responsive widths. Keep source alt text editorially meaningful. |
| High | No real-world Core Web Vitals or Lighthouse results can be claimed from source inspection. | Run Lighthouse mobile on homepage, Ilorin landing page and a property detail page; review Search Console CWV/CrUX after traffic accrues. |
| Medium | Existing destination state pages are intentionally `noindex` until there is substantive local content; upcoming destination placeholders should not be indexed. | Keep this rule. Publish unique local content and approved inventory before enabling indexing. |
| Medium | Search results and arbitrary query/filter URLs are intentionally noindex and disallowed in robots to avoid crawl traps. | Keep clean category/location landing pages as the crawlable entry points. Do not expose every query-string combination to sitemap. |
| Medium | The app uses a custom image gallery, maps and third-party embeds on detail pages. These can affect LCP/INP if loaded too early. | Keep the primary image prioritized, defer maps/embeds, use fixed aspect ratios, and measure actual field data. |
| Medium | Nearby attractions and businesses share a URL pattern `/nearby/{city}/{slug}`. | Ensure slugs remain unique across those content types within a city or add a type segment before any collision occurs. |
| Medium | Sitemap dynamic routes assume public RLS/view access is configured and data queries succeed. | After deployment, fetch `/sitemap.xml` and verify every URL returns 200, canonical matches, and no unpublished record appears. |
| Low | FAQ rich-result display is not guaranteed by Google, even when valid FAQPage markup is present. | Treat JSON-LD as semantic markup, not a promise of enhanced SERP display. |

## Recommended content plan (no generated filler)

- Create a genuinely useful Ilorin destination guide with original local editorial review: neighbourhood descriptions, transport context, visitor planning notes, and references for factual claims.
- Publish distinct category copy for hotels, shortlets and serviced apartments only when it can explain meaningful differences and the available inventory.
- Expand Kwara town guides only as local information and approved listings meet the existing publication threshold.
- Ensure each property listing has a unique description, accurate category, complete address hierarchy, current provider-supplied price basis, descriptive image alt text and contact details.
- Never manufacture review text, ratings, property counts, prices, amenities, landmarks or availability claims to fill SEO pages.

## Deployment and validation checklist

- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final canonical HTTPS hostname in Vercel Production.
- [ ] Confirm `NEXT_PUBLIC_APP_ENV=production` in production; preview/development should remain non-indexable.
- [ ] Deploy and open `/robots.txt` and `/sitemap.xml`.
- [ ] Validate sitemap URLs return HTTP 200 and contain only approved/published records.
- [ ] Test canonical, robots meta, OG and Twitter metadata on homepage, property, destination, journal and accommodation pages.
- [ ] Validate JSON-LD with Schema.org Validator / Rich Results Test; check property pages contain no rating or availability claims unsupported by data.
- [ ] Run Lighthouse mobile on homepage, Ilorin hotels page and one property detail page; record LCP, INP proxy/TBT, CLS and image transfer size.
- [ ] Submit sitemap in Google Search Console and Bing Webmaster Tools.
- [ ] Inspect index coverage and CWV after crawl/traffic data becomes available.

## Files changed

- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/layout.tsx`
- `src/app/(public)/accommodation/[location]/[category]/page.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/properties/[slug]/page.tsx`
- `src/app/(public)/faq/page.tsx`
- `src/components/ui/breadcrumbs.tsx`
- `src/components/properties/property-gallery.tsx`

## Verification status

The code was reviewed against the existing schema and route structure. A production build, TypeScript check, automated test suite, live Supabase query, deployed robots/sitemap fetch, Lighthouse run and Search Console inspection have not been performed in this environment. Do not interpret this document as evidence that Google has crawled or indexed the site.
