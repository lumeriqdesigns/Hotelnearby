# Hotelnearby Prompt 13: database review and migration report

Status: **proposal for approval. Nothing has been applied to any database.**
No PostgreSQL server was available while this was prepared, so none of the SQL has been executed. Brace/`$$` balance was checked mechanically only. The first real test is applying 008-012 to a development Supabase project and running `supabase/tests/schema_invariants.sql`.

## 1. What was reviewed
Seven migrations (`202611240001`-`007`), `docs/architecture.md`, the README migration notes, and the app code that reads or writes the affected tables. Production state is unknown to me: run `supabase/preflight/001_read_only_checks.sql` and send the output before anything is applied.

## 2. Findings in the existing schema
| # | Sev | Finding | Fix |
|---|---|---|---|
| S1 | **High** | The approval/organisation guard (004/005/007) only restricted users whose profile role is `provider_owner` or `provider_staff`. A member whose profile role is `visitor` or `editor_moderator` (reachable via `set_platform_role`, or by accepting an invitation as a moderator) keeps RLS write access through membership but skips the guard, so could set their own listing to `approved`. | 008 s1: guard applies to everyone except an active administrator or service_role |
| S2 | Med | `admin_audit_logs` is described as append-only but only has no UPDATE/DELETE grant for `authenticated`. service_role and the owner can still edit or delete rows. | 008 s7: trigger blocks UPDATE/DELETE/TRUNCATE, privileges revoked; only the account-erasure `SET NULL` is allowed |
| S3 | Med | Providers (including staff) can hard-delete a property; FK cascades silently delete its enquiries and listing reports. The app does this in `deletePropertyAction`. | 008 s4: only drafts with no enquiry/report history can be deleted by users; service_role unaffected |
| S4 | Med | `price_updated_at` could be set directly by a provider, making a stale price look current (trigger only fired when price columns were in the SET list). | 008 s3 |
| S5 | Med | Owners could insert any user id into `provider_memberships` directly, bypassing the invitation / verified-email path. App does not use this path. | 008 s5: policy and grant removed |
| S6 | Med | `destination_quality_metrics.approved_property_count` is never maintained, so the destination publication gate (minimum approved properties) can never pass and homepage counts stay 0. | 009 s3: trigger plus backfill (see risk R2) |
| S7 | Med | Admin approve/reinstate has no state machine: a never-submitted draft can be approved; "reinstate" can approve a rejected listing. | 008 s2 |
| S8 | Med | `profiles` is readable table-wide by teammates and own user, including `suspension_reason` and `suspended_by` (internal moderation text). | **Not fixed.** Needs a separate moderation table or view and app query changes. Decision D5 |
| S9 | Low | `location_nodes.country_code` is hard-coded to `NG`, contradicting international readiness; unique `(parent_id, slug)` does not stop duplicate root rows because NULLs are distinct. | 008 s6 |
| S10 | Low | No admin policies on listing child tables, and no way to triage listing reports. | 009 s9 |
| S11 | Low | `updated_at` never refreshed on 6 tables; 14 foreign keys unindexed. | 008 s8, s9 |
| S12 | Low | `property_enquiries` rate limit keys on the sender-supplied contact string (trivially varied). | Column `client_hash` added in 010; RPC change is app work (Prompt 20/22) |
| S13 | Low | Search RPC uses `ilike '%q%'` over a view that recomputes ancestry for every approved property; trigram indexes will not be used. Will degrade past a few thousand listings. | 009 caches `city_location_id`/`state_location_id`; rewriting the RPC is a follow-up (D6) |
| S14 | Low | Several FKs to `auth.users` are `ON DELETE RESTRICT`, so an account cannot be erased without manual anonymisation. | Audit log fixed in 008; remaining ones listed in D7 |
| S15 | Info | README still tells you to set `app_metadata.role = admin`. Migration 004/007 replaced that with `profiles.role`; docs are stale. | Documentation fix |

## 3. What the new migrations add
| File | Content | Risk |
|---|---|---|
| 008 corrections | S1-S5, S7, S9, S11; helpers `is_administrator`, `has_staff_permission`; `audit_row_change`, `prevent_row_mutation` | Behavioural (section 4) |
| 009 listing normalisation | `accommodation_categories`, `amenities`, `property_amenities`, `room_amenities`, `property_contacts`, `room_images`, `price_history`; storage columns on `property_media`; cached city/state on `properties`; destination counts (S6) | Additive; backfills |
| 010 visitor and operations | `saved_properties`, `recently_viewed`, `comparisons`, `comparison_items`, `newsletter_subscribers`, `notifications`, `support_tickets`, `support_ticket_messages`; enquiry columns | Additive |
| 011 billing and promotions | plans, prices, features, `subscriptions`, `subscription_payments`, `payment_events`, `webhook_events`, `refunds`, `invoices`, `invoice_items`, `promotion_prices`, `promotional_inventory`, `promotions`, billing settings, `active_promotions` view | Additive; seeds approved prices; one behavioural rule (photo limits) |
| 012 trust, content, retention | `verification_records`, `reviews`, `attractions`, `local_businesses`, `events`, `blog_*`, `ai_listing_drafts`, `analytics_events`, `data_retention_policies` | Additive |

Design rules enforced in the database: one live subscription per property; successful payment requires server verification matching the expected total; price amounts immutable (new row instead); exclusive promotion slots cannot overlap; issued invoices frozen; payment events append-only; refunds cannot exceed the amount paid; reviews expose no author ids; verification has no link to subscriptions; no booking, availability, payout or commission tables (checked by test C).

Migration history: Supabase's own `supabase_migrations.schema_migrations` records applied versions; the new files keep the existing 12-digit `2026112400NN` numbering so ordering is unchanged. All migrations are forward-only; rollback for 008-012 is restore-from-backup, so take a snapshot first.

## 4. Behaviour changes the app will notice (need your OK)
1. Non-admin users can only move listings along: draft to pending, rejected/correction/approved to pending. Admin RPC can no longer approve a draft or reinstate a non-suspended listing.
2. Providers can delete only draft listings with no enquiries/reports. Anything else errors; the UI should offer "suspend/archive" later.
3. Direct writes to `price_updated_at` by users are ignored.
4. `properties` saves that change nothing no longer bump `updated_at` (affects "recently updated" sort in a good way).
5. Starter photo limit (8 images) is now enforced on new uploads for non-admins; Professional 30, Premium 60. Existing over-limit properties are untouched (preflight check 5 lists them). Direct video upload needs a plan that includes it.
6. Property create now also creates a free Starter subscription row; every existing property with an organisation gets one in backfill.
7. Owners can no longer insert staff memberships directly (invitation or `add_provider_staff` only).
8. `accommodation_categories` replaces the category CHECK list (existing values all valid).

## 5. Risks to review before applying
- **R1** Backfill in 009 touches every `properties` row (cache columns). `updated_at` is protected, but it will fire triggers; run on staging first and time it.
- **R2** Destination counts: the backfill overwrites stored counts with true counts and can auto-unpublish a destination that was published on a manual number. Preflight check 6 shows exactly which rows change.
- **R3** `btree_gist` is installed in the `extensions` schema (needed for the promotion overlap constraint).
- **R4** Amenity backfill turns every distinct free-text value into a `pending_review` amenity, including typos. Preflight check 8 gives the count.
- **R5** The text[] amenity columns and contact columns remain the write path for now; triggers mirror them. Two sources exist until the contract step in section 6.
- **R6** Retention intervals and the 7-year financial retention are placeholders; I am not asserting any legal requirement. Confirm with an accountant and counsel (Nigeria Data Protection Act) before enabling anything. Every policy row is disabled and the preview function only counts.
- **R7** Invoice numbers use a database sequence; sequences can skip numbers on rollback. If your tax advisor requires gapless numbering, this needs a different design.
- **R8** Nothing here covers Supabase Storage bucket policies, backups/PITR settings, or Paystack. Those are Prompt 14, 22 and 24.

## 6. Deferred destructive or production-affecting steps (NOT written, need separate approval)
1. Drop `properties.amenities`, `property_room_categories.amenities`, `property_apartment_units.amenities` after the app reads from the normalised tables and search is rewritten.
2. Drop `properties.phone_number/whatsapp_number/contact_email/website_url` after the public RPC reads `property_contacts`.
3. `properties.organisation_id SET NOT NULL` (needs preflight check 4 to be empty).
4. Renaming tables to the playbook names (not recommended: breaks code and RPCs for no functional gain; mapping table in `erd.md` instead).
5. Production application of 008-012 and any enabling of retention deletion.

## 7. Decisions needed from you
- **D1** Apply 008-012 to a development project now? (Recommended order: preflight, 008, 009, tests, 010-012.)
- **D2** Accept the behaviour changes in section 4, especially 1, 2 and 5.
- **D3** City and category promotion prices: the playbook says "from N5,000" with no duration. I seeded no row. Give duration(s) and price(s).
- **D4** Promotion flow: I modelled pay first, then admin approval (refund if rejected). The alternative is approve first, then pay. This changes `promotions` status rules.
- **D5** Fix S8 (suspension reason exposure) with a separate admin-only moderation table?
- **D6** Rewrite `search_public_properties` to use the cached city/state ids and escape `%`/`_` in the query?
- **D7** Make remaining `auth.users` FKs erasure-friendly (`SET NULL` plus snapshot columns)?
- **D8** Keep `admin_audit_logs` as the single audit table (recommended) rather than adding a second `audit_logs`.

## 8. Not verified
Everything. No SQL was run; RLS was reviewed by reading, not by testing with real sessions. The invariant test file covers structure; role-based RLS tests (provider A vs B, visitor, moderator) still have to be run with real test accounts.
