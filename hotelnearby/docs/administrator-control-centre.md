# Administrator control centre — Prompt 12

## Access boundary

- `/admin/*` is server-protected by `requirePlatformRoles(["administrator"])`.
- Every server action repeats the administrator check. Database RPCs independently check `current_platform_role()`.
- `current_platform_role()` returns no role for a suspended profile.
- Provider membership helpers reject suspended profiles and suspended organisations.
- The last active administrator cannot be suspended or demoted.
- No public signup path can create an administrator account.

## Implemented modules

| Module | Current capability |
| --- | --- |
| Overview | Live counts from profiles, organisations, properties, pending/approved properties, suspended accounts, AI usage and recent audit events. Missing sources show unavailable rather than zero. |
| Users | Latest 100 user profiles, platform role assignment, account suspension and reinstatement. |
| Provider organisations | Latest 100 organisations, suspension and reinstatement. |
| Property moderation | Approve, reject, request corrections, suspend and reinstate. |
| Verification | Separate verification status and evidence/decision note. Subscription status does not change verification. |
| Locations/destinations | Existing destination curation, quality-gated publishing, homepage city selection and content/landmark entry. |
| AI usage | Actual organisation/day usage totals and latest guide sessions. |
| Audit logs | Latest 200 append-only events, actor, target, reason and before/after state. |
| Permissions | Assign/revoke a small set of staff permission grants; changes are audited. The downstream staff workspaces that consume these grants are a later stage. |

## Modules with pending database/integration foundations

Categories, featured inventory, promotions, subscriptions, payments/refunds, general content, Travel Journal, events, attractions/local businesses, newsletter, full reports/analytics, support tickets and configurable runtime settings have navigation entries and honest dependency/status pages. No fake controls, statistics, payments, tickets, campaigns or records are created. These depend on the production database and later product stages.

## Migration and configuration

Apply `supabase/migrations/202611240007_administrator_control_centre.sql` after migration 006 in a development Supabase project. Do not apply to production without review and explicit approval. Existing login/profile access queries now read `profiles.account_status`; apply migration 007 before running the updated application.

The first administrator remains bootstrapped out-of-band as documented in `README.md`. Never grant administrator through public signup or editable user metadata.

## Validation

Static TypeScript/TSX transpilation and source-level security assertions are included. Full `npm run check`, Next.js build, Supabase migration execution, RLS/RPC tests and end-to-end browser checks require dependencies and a configured development Supabase project; they have not been represented as passed in this package.
