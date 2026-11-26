# Hotelnearby trust, verification, reviews and disputes

## Editorial and moderation principle

Hotelnearby does not process accommodation bookings. A visitor review is therefore **not** a confirmed-guest review by default. New reviews are pending and start with `evidence_level = unverified`. Only an authorised human reviewer can publish, reject or remove a review. A reviewer may separately mark evidence as `evidence_supplied` or `verified`; `verified` requires a named reviewer, timestamp and a substantive evidence note. Published pages show the evidence level and do not invent a review count or average when no reviews exist.

Property approval, property verification and provider subscription are separate decisions. A paid subscription or promotion never changes verification status. Verification records retain evidence references, reviewer, decision note, review time and validity dates.

## Provider workflow

1. Provider signs in and opens `/dashboard/trust`.
2. Provider selects a property, evidence type and uploads supporting material to the private `property-verification` Storage bucket under `<property-uuid>/<opaque-filename>`.
3. Provider submits the object path and an explanation. The record is created as `submitted`; no public badge changes automatically.
4. An administrator opens `/admin/trust`, checks the private evidence and records `in_review`, `verified`, `rejected`, `expired` or `revoked` with a reason.
5. The verification record and property's separate verification status are updated in one database transaction. Each decision is audited.
6. Provider can review status and submit an administrative dispute from `/dashboard/trust`.

Do not store raw identity numbers, passwords, bank details or unrestricted public document URLs in notes. The Storage bucket is private; access is limited to the owning provider team and authorised verification reviewers.

## Review workflow

1. A signed-in user with verified email submits a review from a property page. The month of visit is optional and self-reported.
2. Review enters `pending` and `unverified`. There is no booking-confirmation integration and no automatic confirmed-stay claim.
3. An administrator or moderator with `reviews.moderate` reviews content and any supplied evidence, then publishes, rejects or removes it with a reason.
4. Evidence status is a separate decision: `unverified`, `evidence_supplied` (not independently checked), or `verified` (reviewer, timestamp and evidence note required).
5. Providers can respond to published reviews from `/dashboard/trust`. Responses are public and must not disclose private guest information.

## Reports and disputes

- Visitors can report a property or review from its public property page. The form collects a reason and explanation, not a mandatory identity document or precise location.
- Reports enter `open`; administrators/moderators with `reports.view` can investigate, request action, resolve or dismiss with a reason.
- Providers can open a dispute from `/dashboard/trust`. Disputes are reviewed by authorised staff and receive a reasoned outcome (`upheld`, `not_upheld` or `closed`) or a request for more information.
- Reports do not automatically delist a property, remove a review or suspend an account. Staff must make and record a separate decision.

## Audit and permissions

Migration `202611250017_trust_verification_reviews_reports.sql` adds report, dispute and trust audit tables, private verification storage policies, and the atomic verification decision RPC. Generic row-change audit records updates/deletes; `trust_audit_events` records review submissions and explicit moderation decisions. The trust audit table is append-only for application roles.

Grant narrowly to active `editor_moderator` accounts:
- `verification.review` for verification evidence review;
- `reviews.moderate` for review moderation and dispute review;
- `reports.view` for report triage.

Administrators retain full access. Moderators do not receive payment, account suspension or platform-administrator powers.

## Deployment and approval checklist

1. Apply migrations 001–016 in order, then migration 017, to a development Supabase project.
2. Confirm private Storage bucket `property-verification` exists and its policies deny anonymous reads.
3. Create or confirm a test provider organisation and property; upload a non-sensitive test PDF to the property's UUID folder.
4. Submit evidence, verify it as an administrator, and confirm both the verification record and property status change together.
5. Submit an unverified review, confirm it is pending and unpublished, then publish it without changing its evidence level. Separately test evidence-supplied and evidence-verified decisions.
6. Test provider response, listing report, report resolution, dispute submission and dispute outcome.
7. Confirm anonymous visitors can submit reports but cannot read reports, private evidence or moderation notes.
8. Confirm all status changes have actor, time and reason in the audit trail.

This workflow is implemented for review and approval; it does not auto-verify providers, auto-confirm guests, or automatically enforce reports.
