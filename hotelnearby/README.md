# Hotelnearby

**Find places worth staying.** An accommodation discovery and property showcase directory,
starting in Ilorin, Kwara State, Nigeria. The brand name is provisional.

> **This is not a booking platform.** There is no online booking, reservation management,
> availability calendar, guest check-in/out, guest payment, provider payout or booking
> commission, and none may be added. Visitors contact providers directly. Revenue comes from
> provider subscriptions and approved promotions only.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage)
· Vercel · Paystack (provider subscriptions and promotions only) · GitHub

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in your own values
npm run dev                  # http://localhost:3000
```

The app runs without Supabase configured. In development it logs a warning and the landing page
works. Outside development the server refuses to start until required variables are set.

## Scripts

| Command                           | Purpose                            |
| --------------------------------- | ---------------------------------- |
| `npm run dev`                     | Development server                 |
| `npm run build` / `npm start`     | Production build and server        |
| `npm run lint` / `lint:fix`       | ESLint                             |
| `npm run typecheck`               | TypeScript, strict                 |
| `npm test`                        | Unit tests (Vitest)                |
| `npm run format` / `format:check` | Prettier                           |
| `npm run check`                   | Lint, typecheck and tests together |

## Environments

| Environment | Hosting                    | Supabase project | Paystack                  |
| ----------- | -------------------------- | ---------------- | ------------------------- |
| development | local                      | dev              | test                      |
| staging     | Vercel preview / `staging` | staging          | test                      |
| production  | Vercel (`main`)            | production       | live, only after approval |

Set staging and production variables in Vercel, never in files. Use a separate Supabase project
for each environment. `NEXT_PUBLIC_APP_ENV` controls validation strictness and whether search
engines may index the site (production only).

## Project layout

```
src/app/            routes (route groups: (public) (auth) (provider) (admin)), api/
src/features/       one folder per domain: actions, queries, schemas, components
src/components/     ui/, layout/, feedback/ (error, loading, empty states)
src/lib/            env/, supabase/, errors, logger, safe-action, site
supabase/           migrations/ and RLS tests
tests/              unit/ and e2e/
docs/               architecture decisions
```

## Rules that matter

- Validate and authorise on the server for every action. Frontend checks are cosmetic.
- Row Level Security is the real data boundary. The service-role client
  (`src/lib/supabase/admin.ts`) bypasses it, is server-only, and is blocked from UI code by ESLint.
- Never commit secrets. Only `.env.example` (placeholders) is tracked.
- Migrations are forward-only and reviewed on staging before production.
- Never display the same price without: "Prices may change. Contact the property to confirm the
  current price and availability."

The design system is documented in `docs/design-system.md` and shown at `/design-system` (not served in production).

See `docs/architecture.md` for decisions and the roadmap, and `AGENTS.md` for notes on this
Next.js version, which differs from older releases (for example `proxy.ts` replaces middleware,
and error boundaries receive `retry`).


## Prompt 6 destination discovery

The Nigeria-first geographic directory, public destination routes, administrator curation page and publication-quality gate are documented in `docs/destinations.md`. Apply `supabase/migrations/202611240001_location_destination_discovery.sql` to a development Supabase project before testing `/admin/destinations`. The page requires an authenticated account with a trusted `app_metadata.role = admin` claim. Do not set admin claims from user-editable metadata.

## Prompt 7 — accommodation search

The public `/search` page uses the Supabase `search_public_properties` RPC and only displays approved, active property records. Apply `supabase/migrations/202611240002_property_search.sql` after the destination migration. No sample property records are inserted. See [`docs/search.md`](docs/search.md) for filters, URL parameters, indexing and the planned schema extensions for the provider and final database stages.

### Prompt 8 — Public property detail pages

- Added `/properties/[slug]` for approved active listings, with SEO metadata, image gallery, supported video embeds/direct video playback, address and map, amenities, house rules, check-in/out, contacts, nearby landmarks and similar properties.
- Added separate `property_room_categories` and `property_apartment_units` data models; room categories are not represented as individually managed apartments.
- Supports nightly, daily, weekly, monthly, per-stay and other approved pricing bases, public price-update dates, and the exact price disclaimer.
- Added public enquiry and listing-report forms backed by validated API and narrowly scoped Supabase RPCs. No booking controls, availability calendar or guest payment flow is included.
- Apply `supabase/migrations/202611240003_property_detail_pages.sql` after Prompt 6 and Prompt 7 migrations. See `docs/property-details.md`.
- Live database, media rendering and form submission remain unverified until Supabase is configured and the migration plus genuine approved listing data are installed.

## Prompt 9 — Supabase authentication and authorisation

The authentication stage adds cookie-based Supabase SSR sessions, email/password registration and sign-in, email verification callback handling, password recovery, password updates, profile editing, local sign-out, protected account/provider/administration routes and optional TOTP MFA enrollment. The Next.js 16 `proxy.ts` refreshes and validates the session using `auth.getClaims()`; protected server routes independently validate the user with `auth.getUser()` and load the role from `public.profiles`.

### Apply the database migration

Apply `supabase/migrations/202611240004_authentication_and_authorisation.sql` after migrations 001–003. It creates profiles, provider organisations and memberships, a restricted role model, profile triggers, helper functions and RLS policies. Public signup can request only `visitor` or `provider_owner`; the database trigger independently allow-lists those two roles. `provider_staff`, `administrator` and `editor_moderator` cannot be self-assigned. Provider owners can add an already-registered, email-verified account as staff using the `add_provider_staff` RPC. A provider staff invitation email workflow is a later provider-management feature.

### Supabase dashboard configuration

1. Set Site URL to the deployed Hotelnearby origin and add `http://localhost:3000/**`, the deployed origin's `/auth/confirm`, and `/auth/callback` to allowed redirect URLs.
2. Enable email confirmations. In the **Confirm signup** email template, use `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>`. In the **Reset password** template, use `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>`. The server-side `/auth/confirm` endpoint verifies each token hash and writes a cookie-backed session.
3. Configure password minimum length to at least 10 characters, sensible password strength checks, SMTP delivery and Auth rate limits. Add CAPTCHA to public signup/recovery before production if abuse controls are required.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` in the local environment and deployment platform. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable or browser code.
5. Bootstrap the first administrator manually in the Supabase SQL Editor after the first administrator account has signed up and verified its email. Replace the placeholder email with the intended account:

   ```sql
   update public.profiles
   set role = 'administrator'
   where id = (
     select id from auth.users
     where lower(email) = lower('YOUR_VERIFIED_ADMIN_EMAIL')
       and email_confirmed_at is not null
     limit 1
   );
   ```

   There are no hardcoded administrator credentials or seeded accounts. After bootstrap, administrators can grant platform staff roles using the protected `set_platform_role` RPC.

### Roles and protection

- `visitor`: ordinary signed-in account.
- `provider_owner`: public provider registration; owns a provider organisation created by the auth trigger.
- `provider_staff`: added by a provider owner to an existing verified account for that organisation.
- `administrator`: platform-wide administration role, assigned only by an existing administrator (first admin is bootstrapped out of band).
- `editor_moderator`: moderation/editor role, assigned only by an administrator.

Server layouts protect `/dashboard` and `/admin/*`; account profile and security pages require an authenticated account. The database policies are authoritative. Provider membership is organisation-scoped, profile users cannot update their own role, and providers cannot approve or self-verify their listings. Public property reads remain restricted to approved active listings.

### MFA and session notes

`/account/security` supports TOTP enrollment, QR setup, code verification and factor removal. MFA is optional; enabling a factor moves the account to AAL2 after verification. Supabase project recovery, SMTP, password and MFA settings remain deployment configuration. Sign-out revokes the current local session; the proxy refreshes valid sessions on subsequent requests.

### Validation status

The migration and application code are included, but live registration, email delivery/verification, login/logout, password recovery, TOTP enrollment and RLS checks require a configured Supabase project and real test inboxes. Never mark these end-to-end checks as passed until executed in that environment.

## Prompt 10 — Provider dashboard

The provider dashboard lives under `/dashboard`. It supports organisation profile editing, multiple independently marketed properties per organisation, team member visibility, owner-created one-time invitation links, property drafts and edits, room categories, separately managed apartment units, HTTPS photo/video gallery URLs, listing submission for moderator review, enquiry status management, real-record dashboard counts, and a subscription overview placeholder.

Apply `supabase/migrations/202611240005_provider_dashboard.sql` after migrations 001–004. The dashboard uses the signed-in Supabase session and RLS; no service-role credential is used. Team invitation email delivery, direct Storage uploads, subscription billing and live integration testing remain later-stage work. See `docs/provider-dashboard.md`.

## Prompt 11 — AI Listing Guide

The optional provider AI Listing Guide is available at `/dashboard/ai-listing`; standard manual creation remains at `/dashboard/properties/new`. The guide asks structured provider questions and can suggest an accommodation category, draft a neutral description, explain pricing bases, guide location details, distinguish hotel room types from apartment units, suggest amenities for provider confirmation, provide photo guidance, draft house rules and identify missing facts. Generated content is never automatically published or submitted. A provider must review the fields and explicitly save an unpublished draft; administrator approval remains mandatory.

Apply `supabase/migrations/202611240006_ai_listing_guide.sql` after migrations 001–005. Configure server-only `OPENAI_API_KEY` and `OPENAI_MODEL` to enable generation. The organisation-level daily limit is 20 requests, each guide is limited to 12 turns, and each model response is limited to 1,100 output tokens. Session, usage and audit events are stored with provider-scoped RLS. Without AI credentials, the manual workflow remains available. See `docs/ai-listing-guide.md` for safeguards, setup and limitations.

## Prompt 12 — Administrator control centre

The core `/admin` control centre is restricted to active `administrator` accounts; the Travel Journal editorial workspace also permits active `editor_moderator` accounts explicitly granted `content.manage`. It adds live overview counts, user and provider organisation management, property moderation and independent verification decisions, destination administration, AI usage reporting, staff permission grants and append-only audit logs. Suspended users are denied application authentication context; suspended organisations lose provider membership access. Last-active-administrator lockout protections are enforced in database RPCs.

Apply `supabase/migrations/202611240007_administrator_control_centre.sql` after migration 006 before using the updated app. See [`docs/administrator-control-centre.md`](docs/administrator-control-centre.md) for implemented modules, pending dependencies and validation status. Several operational modules remain dependent on their respective integrations. The Travel Journal CMS is implemented with editorial workflow, taxonomy, image storage, SEO article pages and related destination/property links; see [`docs/travel-journal-cms.md`](docs/travel-journal-cms.md). No statistics or business records are fabricated.

## Promotional placements (Prompt 15)

Provider-paid featured, homepage, city and category placements are implemented with verified Paystack settlement, administrator review, exclusive inventory scheduling, automatic activation/expiry, sponsored-only public display and impression/click reporting. See [`docs/promotions.md`](docs/promotions.md) and migration `202611250014_promotional_placement_runtime.sql`. Apply database migrations only after the documented development preflight and approval.


## Travel Journal CMS

The editorial CMS supports draft, in-review, preview, scheduling, publishing and unpublishing; ten travel content categories; tags and author attribution; featured-image uploads; SEO and canonical metadata; related properties, destinations and articles; public category/article pages; and scheduled publication through the existing cron endpoint. Apply `supabase/migrations/202611250015_travel_journal_cms.sql` after migrations 001–014. See [`docs/travel-journal-cms.md`](docs/travel-journal-cms.md) for the editorial workflow and release checks.


## Nearby discovery and events directories

See [docs/nearby-events-directories.md](docs/nearby-events-directories.md) for public routes, admin moderation, verification requirements, accommodation cross-links and deployment checks. Apply migration `202611250016_nearby_events_directories.sql` after migrations 001–015.

## Visitor travel tools

The public visitor workspace is available at `/travel-tools` and `/my-travel`. It supports property comparisons (maximum three), saved properties and named wishlists, recently viewed listings, accommodation and trip budget estimates, group cost splitting, coordinate-based straight-line distance, a travel checklist, neighbourhood information and a property-feature suitability checklist. Property comparisons, prices, facilities, neighbourhoods and coordinates are sourced from approved live property records; missing listing information is shown as missing rather than inferred.

Anonymous planning data is stored in the visitor's browser using local storage. Signed-in users additionally sync saved lists, recently viewed properties and comparisons through the RLS-protected tables/functions created in migration `202611240010_visitor_tools_and_operations.sql`. Local expense notes, checklist state and group-planning inputs remain browser-local and should not contain sensitive information. No booking, payment, identity or card details are collected by these tools.

## Trust, verification, reviews and disputes

The provider trust workspace is `/dashboard/trust`; administrators review verification evidence, visitor reviews, reports and disputes at `/admin/trust`. Reviews remain unverified unless an authorised moderator records evidence checks. Hotelnearby does not process bookings and never labels all reviews as confirmed guests. See [`docs/trust-and-safety.md`](docs/trust-and-safety.md) and apply migration `202611250017_trust_verification_reviews_reports.sql` after migrations 001–016.


## Contact, human support and chatbot

- `/contact` contains visitor/provider support, advertising, partnership and general listing-report request intake.
- `/faq` contains reviewed platform guidance.
- `/admin/support` is the staff support inbox; assign `support.manage` to authorised moderators.
- The persistent chatbot uses curated FAQ answers and the live `search_public_properties` RPC. It does not use an LLM or invent property facts. Unknown questions are escalated to human support.
- Configure `NEXT_PUBLIC_SUPPORT_WHATSAPP` with the official international support number (digits or leading `+`). If it is not configured, the persistent support control opens `/contact`.
- Apply migration `202611250018_contact_support_chatbot.sql` after migration 017.
- Hotelnearby does not confirm availability, make accommodation reservations or process guest accommodation payments.

## Technical SEO and public discovery pages

- Production crawl controls are generated by `src/app/robots.ts`; non-production deployments disallow crawling. Set `NEXT_PUBLIC_SITE_URL` to the final canonical HTTPS domain and `NEXT_PUBLIC_APP_ENV=production` only in Vercel Production.
- `src/app/sitemap.ts` generates the XML sitemap from approved property, published destination/editorial and verified local directory records. It refreshes hourly and omits low-value accommodation pages until they meet the publication thresholds.
- Ilorin and Kwara category landing pages are available under `/accommodation/{ilorin|kwara}/{hotels|shortlets|serviced-apartments}`. They remain `noindex` and are omitted from the sitemap until at least three matching listings have a meaningful description (80+ characters) and an image or sufficient amenity/feature data.
- Individual property pages are added to the sitemap and allowed to index only when the listing has a meaningful description (80+ characters) and an image or at least three amenity/feature values. Approved but incomplete records remain accessible but noindex.
- Public property pages emit LodgingBusiness structured data; shared breadcrumbs emit BreadcrumbList; the site emits Organization/WebSite JSON-LD; visible FAQs emit FAQPage markup. No review rating, offer or availability claims are fabricated.
- See `docs/seo/SEO_AUDIT_AND_IMPLEMENTATION.md` for implementation details, remaining risks and the production validation checklist.

## Authentication experience update — November 2026

- Added a dedicated `/admin/login` entry point outside the protected admin route layout. It accepts only active `administrator` and `editor_moderator` profiles; non-admin accounts are signed out and shown a generic access-denied message.
- Added `/providers/sign-in` as a dedicated provider portal entry point. Standard sign-in now routes provider roles to `/dashboard`, platform roles to `/admin`, and visitors to `/account/profile` based on the trusted `profiles.role` record.
- Added a shared responsive hospitality split-screen frame using the existing homepage hero image. The desktop left panel is image-led with the requested “GUIDE & DESIGN” overlay; it collapses into a compact image banner on smaller screens.
- Existing Supabase auth actions, registration validation, email confirmation, recovery and database role protections remain the underlying authentication system.
- Build/typecheck and live Supabase/email end-to-end tests remain to be run in an environment with dependencies and configured Supabase credentials.
