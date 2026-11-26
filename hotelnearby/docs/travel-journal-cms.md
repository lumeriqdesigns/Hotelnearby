# Hotelnearby Travel Journal CMS

## Editorial scope

The Journal supports destination guides, travel tips, accommodation guides, local experiences, food and restaurants, events and festivals, tourism and culture, budget travel, family travel, and business travel. Migration `202611250015_travel_journal_cms.sql` seeds these ten editorial categories.

## Workflow

1. Open **Administration → Business & content → Travel Journal** (`/admin/travel-journal`). The route accepts administrators and editor/moderators who have the `content.manage` staff permission; the app checks the grant and database RLS independently enforces it.
2. Create or edit an article. Supply a title, unique URL slug, category, author display name, researched Markdown body, excerpt, featured image URL or upload, image alt text, SEO title/description and optional canonical URL.
3. Add tags and link the article to relevant destinations, approved/active properties and other published articles. Use descriptive in-body Markdown links for additional contextual internal links (for example `[places to stay](/search?location=Ilorin)`).
4. Save as draft or in review, then use the private preview (`/journal/preview/<article-id>`) to review layout and links.
5. Publish immediately or schedule a future publication. Scheduled and immediately published articles must have at least 500 characters of body copy, a non-empty SEO description, a valid HTTPS featured image and descriptive image alt text. The cron endpoint publishes due scheduled articles after rechecking these requirements.
6. Published articles can be unpublished from the editorial queue. Unpublished, draft, in-review and future-scheduled articles are not visible to public queries or indexed.

## Public experience and SEO

- `/journal` lists published articles and category navigation.
- `/journal/<slug>` renders an article, author, publication date, tags, related destination/property/article links, canonical metadata, Open Graph/Twitter metadata and `Article` JSON-LD.
- `/journal/category/<slug>` renders category archives.
- Destination pages surface related published guides when the article is linked to that destination.
- `src/app/sitemap.ts` includes published articles and active category archives.
- The Markdown renderer supports paragraphs, H2/H3 headings, ordered/unordered lists, bold/italic and relative or HTTPS links. It never renders raw HTML.

## Image storage

The migration creates a public-read `journal-images` bucket. Authenticated content staff may upload JPG, PNG, WebP or AVIF images up to 8 MB under their own user folder. Public read access is required for the featured images to render.

## Editorial quality guardrails

The CMS does not generate articles in bulk. It has no automatic article-writing job. Editors are responsible for fact checking, local accuracy, source attribution where appropriate, updating time-sensitive advice and using only relevant links. The minimum body length is a publishing floor, not a quality score or a recommendation to pad copy. Avoid unsupported claims, invented business details, keyword stuffing, repetitive city pages and links inserted only to manipulate rankings.

## Deployment

Apply migrations 001–014 in order if not already applied, then apply `202611250015_travel_journal_cms.sql`. Confirm the `content.manage` permission is assigned to the intended editorial staff. Ensure the existing cron endpoint is scheduled and `CRON_SECRET` is configured so scheduled publication runs. The repository currently schedules this shared worker daily at 02:15 UTC (`vercel.json`); scheduled articles therefore publish on the first run after their scheduled time, not necessarily at the exact minute. Increase the cron frequency only if the deployed Vercel plan supports it. No environment variable is added by this feature.

## Verification status

The implementation includes unit tests for publishing-quality rules, canonical resolution and scheduled publication timing. Static syntax checks are performed when packaging. Database migration execution, Supabase Storage upload, authenticated role/RLS workflow, scheduled cron publication and a production Next.js build must still be verified in the connected development environment before production release.
