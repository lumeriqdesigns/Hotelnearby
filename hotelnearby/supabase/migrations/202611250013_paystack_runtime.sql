-- Prompt 14 runtime additions. Apply only after migrations 001-012 have been reviewed and applied.
-- Paystack is restricted to Hotelnearby platform subscriptions and promotional placements.
alter table public.subscription_payments add column if not exists billing_metadata jsonb not null default '{}'::jsonb;
alter table public.subscriptions add column if not exists paystack_subscription_code text;
alter table public.subscriptions add column if not exists last_renewal_attempt_at timestamptz;
alter table public.subscriptions add column if not exists renewal_failure_count integer not null default 0 check (renewal_failure_count >= 0);
alter table public.subscriptions add column if not exists next_retry_at timestamptz;
alter table public.subscriptions add column if not exists renewal_consent_at timestamptz;
alter table public.platform_billing_settings add column if not exists processing_fee_basis_points integer not null default 0 check (processing_fee_basis_points between 0 and 10000);
alter table public.platform_billing_settings add column if not exists processing_fee_fixed_kobo bigint not null default 0 check (processing_fee_fixed_kobo >= 0);

-- Reusable payment authorizations are isolated from provider-readable subscription rows.
-- Only trusted server code (service_role) may read or write this table.
create table if not exists public.subscription_payment_methods (
  subscription_id uuid primary key references public.subscriptions(id) on delete restrict,
  organisation_id uuid not null references public.provider_organisations(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  authorization jsonb not null check (jsonb_typeof(authorization) = 'object'),
  reusable boolean not null default false,
  signature text,
  billing_email text not null,
  card_type text,
  last4 text,
  bank text,
  exp_month text,
  exp_year text,
  updated_at timestamptz not null default now(),
  check (reusable = true)
);
create index if not exists subscription_payment_methods_org_idx on public.subscription_payment_methods(organisation_id);
alter table public.subscription_payment_methods enable row level security;
revoke all on public.subscription_payment_methods from anon, authenticated;
grant all on public.subscription_payment_methods to service_role;

create index if not exists subscriptions_due_renewal_idx on public.subscriptions(current_period_end, next_retry_at)
  where status in ('active','grace') and auto_renew = true and cancel_at_period_end = false;
comment on column public.platform_billing_settings.processing_fee_basis_points is 'Configurable platform checkout fee rate; disclosed separately and paid by the provider. Not Paystack settlement pricing.';
comment on column public.subscriptions.renewal_consent_at is 'Timestamp of explicit provider opt-in to recurring renewal.';
-- Exactly one paid invoice per payment and one verification event per payment.
create unique index if not exists invoices_one_per_payment_uidx on public.invoices(payment_id) where payment_id is not null;
create unique index if not exists payment_events_one_verified_uidx on public.payment_events(payment_id, event_type) where event_type = 'payment.verified';
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check check (status in ('requested','approved','processing','needs_attention','succeeded','rejected','failed'));
alter table public.refunds add column if not exists paystack_refund_id bigint;
create index if not exists refunds_paystack_refund_id_idx on public.refunds(paystack_refund_id) where paystack_refund_id is not null;
alter table public.subscription_payment_methods add constraint subscription_payment_methods_valid_authorization
  check (authorization ->> 'reusable' = 'true' and length(coalesce(authorization ->> 'authorization_code', '')) > 0);
