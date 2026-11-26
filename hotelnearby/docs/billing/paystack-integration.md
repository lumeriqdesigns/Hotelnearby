# Prompt 14 — Paystack subscriptions and promotions

## Scope and exclusions

Paystack is used only for Hotelnearby provider subscriptions, plan upgrades/renewals, and promotional placements. The integration does not collect guest accommodation payments, process reservations, maintain room availability, pay providers, or calculate booking commissions.

## Commercial configuration

- Starter: free; 8 photos; external video links only.
- Professional: ₦6,000 monthly / ₦60,000 annually; 30 photos; external links and direct video uploads.
- Premium: ₦10,000 monthly / ₦100,000 annually; 60 photos; external links and direct video uploads.
- Enterprise: negotiated.
- One subscription applies to one independently marketed property.
- Featured listing: ₦3,000 / 7 days or ₦10,000 / 30 days.
- Homepage promotion: ₦7,500 / 7 days or ₦25,000 / 30 days.
- City/category promotions require an administrator-configured duration/price, with a minimum of ₦5,000, because the playbook specifies “from ₦5,000” without a fixed duration/price pair.

Amounts are NGN kobo integers and are read from the database on the server. Browser-submitted amounts are never trusted.

## Implemented application paths

- `POST /api/billing/checkout`: provider-owner authorization, per-property subscription checkout, server-side plan price lookup, immediate upgrade proration and unused-value credit.
- `POST /api/billing/promotions`: creates a paid promotion request from the active server-side price table.
- `POST /api/billing/verify`: server-side transaction verification, currency/amount matching, subscription/promotion activation and invoice/receipt creation.
- `POST /api/webhooks/paystack`: raw-body signature verification, timestamp tolerance for current signing-secret format, legacy signature support, webhook deduplication, and verification against Paystack before fulfilment.
- `POST /api/billing/subscription`: explicit renewal opt-in, cancellation at period end and scheduled downgrade.
- `GET/POST /api/cron/billing`: authenticated daily renewal, retry and expiry worker; requires `CRON_SECRET`.
- `POST /api/billing/refunds`: provider-owner refund request.
- `POST /api/admin/refunds`: administrator approve/reject; approved requests are submitted to Paystack.
- `/dashboard/billing`: provider plan controls, checkout fee/tax breakdown, payment history, invoices and receipts.
- `/admin/billing`: grace, retry, tax and provider-paid checkout fee configuration.
- `/admin/refunds`: refund administration.

Reusable authorization data is stored in the service-role-only `subscription_payment_methods` table. It is not exposed by provider-readable subscription queries. Only authorization objects returned by Paystack with `reusable: true` are saved. The exact transaction email is retained for subsequent charges.

## Lifecycle behaviour

- Renewal is opt-in; new subscriptions start with `auto_renew=false`.
- Automatic charging requires a stored reusable Paystack authorization. Otherwise the provider renews manually.
- Upgrade value and unused-value credit are prorated over the remaining current billing period. A billing interval change is deferred to renewal.
- Downgrades are scheduled for the current period end.
- Cancellation disables future renewal but retains the paid plan through the period end.
- Configurable grace period defaults to 7 calendar days. Retry days default to 1 and 3; the cron worker reads these values from `platform_billing_settings`.
- Expiry changes entitlement status only; property content is retained and Starter entitlements apply through the existing `property_entitlement` function.
- Promotions become `pending_approval` after verified payment; payment does not itself approve or guarantee placement.

## Paystack documentation reviewed

- Recurring charges and reusable authorizations: https://paystack.com/docs/payments/recurring-charges/
- Recurring payments / subscriptions comparison: https://paystack.com/docs/v2/payments/recurring
- Subscriptions API: https://paystack.com/docs/payments/subscriptions/
- Webhook signature verification: https://paystack.com/docs/payments/webhooks/
- Verify payments: https://paystack.com/docs/payments/verify-payments/
- Refund API and refund webhooks: https://paystack.com/docs/api/refund/ and https://paystack.com/docs/payments/refunds/
- Transaction initialization: https://paystack.com/docs/v2/payments/online/quickstart

Paystack currently documents recurring authorization charges for cards across its markets and Direct Debit for Nigerian businesses. Paystack-managed subscriptions support cards and Nigerian Direct Debit; mobile-money authorizations are not reusable. The app uses server-scheduled authorization charges because the Hotelnearby lifecycle requires its own opt-in, grace and retry rules.

## Environment configuration

Use test credentials only during development/staging:

- `PAYSTACK_MODE=test`: server-side mode selector; defaults to test and rejects a non-test secret key. `live` is accepted only when `NEXT_PUBLIC_APP_ENV=production`, with a matching live secret key and explicit release approval.
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: optional browser-safe public key (the current flow uses hosted checkout redirect).
- `PAYSTACK_SECRET_KEY`: server-only Paystack test secret key.
- `PAYSTACK_WEBHOOK_SECRET`: server-only signing secret (`whsec_...`) for current Paystack webhook signatures. Legacy `x-paystack-signature` is checked with the Paystack secret key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only; required for webhook, cron and audited billing operations.
- `CRON_SECRET`: server-only bearer secret used by the daily billing cron route.

Configure Paystack webhook URL as `https://YOUR_DOMAIN/api/webhooks/paystack`. Configure the Vercel cron secret and deploy only after approval. No credentials belong in this repository.

## Important operational notes / test status

- Database migration `202611250013_paystack_runtime.sql` is additive and depends on migrations 001–012, including proposed billing migration 011. It has **not** been applied by this implementation session.
- The billing routes and UI are implemented in the source tree, but no live Paystack account, Supabase database, webhook delivery, recurring charge or refund was exercised here.
- `npm ci` did not complete in the execution environment, so TypeScript, ESLint, Vitest and Next production build could not be run. A unit test file covers the pure proration helpers and must be run in the project environment.
- Before staging: apply reviewed migrations to a separate Supabase test project; configure Paystack test keys and webhook secret; test checkout, failed/pending/success states, duplicate webhooks, wrong amounts/currency, opt-in, retries on days 1/3, grace expiry, upgrade proration, scheduled downgrade, cancellation, refunds, invoices and promotion approval.
- Do not switch to live keys, apply migrations to production, or activate live Paystack until explicit release approval.
