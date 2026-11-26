# Architecture decisions

Status: approved foundation (Prompts 1 and 2). Update this file when a decision changes.

## ADR-001 Modular monolith

One Next.js app with feature modules under `src/features`. Features may not import another
feature's internals. Shared code lives in `src/lib` and `src/components`.

## ADR-002 Data access and security

- Reads and writes run as the signed-in person (anon key plus session cookies), so Row Level
  Security applies.
- The service-role client is allowed only in payment webhooks, scheduled jobs and audited admin
  operations, and the caller must be authorised first.
- All prices, plan entitlements and payment status are decided on the server. Money is stored as
  integer kobo.

## ADR-003 Rendering with Cache Components

`cacheComponents` and `partialPrefetching` are enabled. Anything reading cookies or headers
(including `createSupabaseServerClient`) is request-time data and must sit inside `<Suspense>`.
Public pages are cached deliberately with `use cache` where appropriate.

## ADR-004 Errors, logging, config

- Expected failures return `ActionResult` values. Unexpected ones are logged in full and shown as
  a generic message. Route errors use `ErrorState`, which receives `retry`.
- `logger` writes one JSON line per event and redacts sensitive keys.
- Environment is validated in `src/lib/env/schema.ts`. Strictness depends on
  `NEXT_PUBLIC_APP_ENV`. Startup validation lives in `src/instrumentation.ts` and is skipped
  during `next build` so CI needs no secrets.

## Business rules (non-negotiable)

Discovery directory only: no booking, availability calendars, guest payments, payouts or
commissions. Paid plans never imply verification. Paid placements are separate from organic
ranking. Enquiries and contact clicks are not reservations.

## Roadmap

A Prompts 2-4 foundation, design system, layout. B core schema, RLS and auth (pulled forward).
C destinations, search, property pages, homepage. D provider dashboard, AI Listing Guide, admin.
E payments and promotions (test mode). F journal, directory, visitor tools, reviews, chatbot, SEO.
G security audit, full QA, production deployment.

## Deferred on purpose

Session refresh in `proxy.ts` (Prompt 9), Content-Security-Policy (Prompt 22), Sentry wiring,
husky/lint-staged, Playwright e2e.


## Destination discovery (Prompt 6)

See `docs/destinations.md` for the Nigeria-first location hierarchy, destination routes, homepage curation, admin controls and quality-gated publication rules. Upcoming destination pages remain noindex until approved listing and verified-content thresholds are met.

## Prompt 12 — administrator control centre

The administrator workspace is under `/admin` and its server layout requires an active `administrator` profile role. Editors/moderators are not admitted to this control centre. Every mutation action independently checks the same server-side role; Supabase RLS and security-definer RPCs enforce the database boundary. Apply `supabase/migrations/202611240007_administrator_control_centre.sql` after migration 006.

The current control centre implements live overview counts, user role/status management, provider-organisation suspension/reinstatement, property approval/rejection/correction requests/suspension, separate property verification decisions, destination administration, AI usage/session reporting, staff permission grants and an append-only administrator audit log. Suspended profiles are denied application authentication context; suspended organisations lose provider membership access. The database prevents the last active administrator from being suspended or demoted. Provider users cannot change moderator or verification fields, and correction-requested/rejected listings may be resubmitted for review.

Other navigation modules are deliberately marked as awaiting their database/integration stages: dynamic category catalogue, featured inventory/promotions, subscription and payment/refund records, Travel Journal CMS, events, attractions/local business directory, newsletter, support tickets and expanded analytics. They do not display fabricated records or provide fake controls. Subscription and verification remain separate concepts. No guest accommodation payments or booking operations are added.

The migration and code require a configured Supabase development project for live RLS/RPC testing. No production migration is applied by this stage.
