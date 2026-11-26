-- Prompt 13 / migration 011: subscription, payment and promotion schema (data model only).
-- STATUS: PROPOSED. Not applied anywhere. Requires 008-010.
-- Scope: Paystack is used ONLY for Hotelnearby subscriptions and promotions. Nothing here models guest
-- accommodation payments, provider payouts, commissions, availability or reservations.
-- Money: integer kobo (ADR-002). Prices below are the approved commercial configuration from the playbook,
-- stored as data so they can be changed by creating new rows, never by silent edits.
-- The Paystack integration itself (checkout, verification, webhooks, proration) is Prompt 14.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Billing settings (grace period, retries, tax are configuration, not constants)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_billing_settings (
  id boolean primary key default true check (id),
  grace_period_days smallint not null default 7 check (grace_period_days between 0 and 60),
  payment_retry_days smallint[] not null default '{1,3}',
  tax_label text check (tax_label is null or length(tax_label) <= 40),
  tax_rate_basis_points integer check (tax_rate_basis_points is null or tax_rate_basis_points between 0 and 10000),
  processing_fee_note text not null default 'Payment-processing fees are shown separately at checkout and paid by the provider.',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_billing_settings (id) values (true) on conflict (id) do nothing;
comment on column public.platform_billing_settings.tax_rate_basis_points is 'NULL until set by an administrator after professional tax review. Never hard-code a tax rate.';

-- ---------------------------------------------------------------------------
-- 2. Plans, prices, features
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null check (length(trim(name)) between 2 and 60),
  description text not null default '',
  is_custom_priced boolean not null default false,
  is_public boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  billing_interval text not null check (billing_interval in ('monthly','annual')),
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  amount_kobo bigint not null check (amount_kobo >= 0),
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  paystack_plan_code text unique,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create unique index if not exists plan_prices_one_active_uidx on public.plan_prices(plan_id, billing_interval, currency) where is_active;
create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]{1,50}$'),
  value_int integer,
  value_bool boolean,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key),
  check (num_nonnulls(value_int, value_bool) = 1)
);

insert into public.subscription_plans (code, name, description, is_custom_priced, display_order) values
  ('starter','Starter','Free listing for one property.', false, 10),
  ('professional','Professional','Higher media limits and direct video upload.', false, 20),
  ('premium','Premium','Highest standard media limits and direct video upload.', false, 30),
  ('enterprise','Enterprise','Custom, negotiated terms.', true, 40)
on conflict (code) do nothing;

insert into public.plan_prices (plan_id, billing_interval, amount_kobo)
select p.id, v.bill_interval, v.amount from (values
  ('starter','monthly',0::bigint), ('starter','annual',0),
  ('professional','monthly',600000), ('professional','annual',6000000),   -- N6,000 / N60,000
  ('premium','monthly',1000000),     ('premium','annual',10000000)        -- N10,000 / N100,000
) as v(code, bill_interval, amount)
join public.subscription_plans p on p.code = v.code
where not exists (select 1 from public.plan_prices x where x.plan_id = p.id and x.billing_interval = v.bill_interval and x.is_active);
-- Enterprise has no price row on purpose: it is negotiated per organisation.

insert into public.plan_features (plan_id, feature_key, value_int, value_bool)
select p.id, v.key, v.i, v.b from (values
  ('starter','photo_limit',8,null::boolean), ('professional','photo_limit',30,null), ('premium','photo_limit',60,null),
  ('starter','video_external_links',null::integer,true), ('professional','video_external_links',null,true), ('premium','video_external_links',null,true),
  ('starter','video_direct_upload',null::integer,false), ('professional','video_direct_upload',null,true), ('premium','video_direct_upload',null,true)
) as v(code, key, i, b)
join public.subscription_plans p on p.code = v.code
on conflict (plan_id, feature_key) do nothing;

-- Price amounts never change in place: add a new row (and retire the old one) so history stays truthful.
create or replace function public.forbid_price_amount_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.amount_kobo is distinct from old.amount_kobo or new.currency is distinct from old.currency then
    raise exception 'Price amounts are immutable. Retire this row and create a new price instead.';
  end if;
  return new;
end;
$$;
create trigger plan_prices_immutable_amount before update on public.plan_prices for each row execute function public.forbid_price_amount_change();

-- ---------------------------------------------------------------------------
-- 3. Subscriptions: exactly one live subscription per independently marketed property.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  organisation_id uuid not null references public.provider_organisations(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_price_id uuid references public.plan_prices(id) on delete restrict,
  status text not null default 'active' check (status in ('pending_payment','active','grace','expired','cancelled')),
  billing_interval text check (billing_interval is null or billing_interval in ('monthly','annual')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  auto_renew boolean not null default false,                -- renewal is opt-in
  cancel_at_period_end boolean not null default false,      -- cancellation keeps paid access until period end
  cancelled_at timestamptz,
  scheduled_plan_id uuid references public.subscription_plans(id) on delete restrict,   -- downgrade at renewal
  scheduled_change_at timestamptz,
  credit_balance_kobo bigint not null default 0 check (credit_balance_kobo >= 0),       -- unused-value credit after upgrade
  entitlement_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(entitlement_overrides) = 'object'),
  paystack_customer_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_end > current_period_start),
  check (status <> 'grace' or grace_ends_at is not null),
  check ((scheduled_plan_id is null) = (scheduled_change_at is null))
);
create unique index if not exists subscriptions_one_live_per_property_uidx
  on public.subscriptions(property_id) where status in ('pending_payment','active','grace');
create index if not exists subscriptions_org_idx on public.subscriptions(organisation_id, status);
create index if not exists subscriptions_plan_idx on public.subscriptions(plan_id);
create index if not exists subscriptions_plan_price_idx on public.subscriptions(plan_price_id) where plan_price_id is not null;
create index if not exists subscriptions_scheduled_plan_idx on public.subscriptions(scheduled_plan_id) where scheduled_plan_id is not null;
create index if not exists subscriptions_renewal_idx on public.subscriptions(current_period_end) where status in ('active','grace');
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.set_updated_at();
comment on table public.subscriptions is 'A paid subscription never implies verification. Verification lives in verification_records / properties.verification_status.';

create or replace function public.subscriptions_check_organisation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.properties p where p.id = new.property_id and p.organisation_id = new.organisation_id) then
    raise exception 'Subscription organisation must match the property organisation';
  end if;
  return new;
end;
$$;
create trigger subscriptions_org_consistency before insert or update of property_id, organisation_id on public.subscriptions
for each row execute function public.subscriptions_check_organisation();

-- Every property with an organisation gets the free Starter subscription automatically.
create or replace function public.create_starter_subscription()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_starter uuid;
begin
  if new.organisation_id is null then return new; end if;
  select id into v_starter from public.subscription_plans where code = 'starter';
  if v_starter is null then return new; end if;
  insert into public.subscriptions (property_id, organisation_id, plan_id, status)
  select new.id, new.organisation_id, v_starter, 'active'
  where not exists (select 1 from public.subscriptions s where s.property_id = new.id and s.status in ('pending_payment','active','grace'));
  return new;
end;
$$;
drop trigger if exists properties_starter_subscription on public.properties;
create trigger properties_starter_subscription after insert or update of organisation_id on public.properties
for each row execute function public.create_starter_subscription();

insert into public.subscriptions (property_id, organisation_id, plan_id, status)
select p.id, p.organisation_id, (select id from public.subscription_plans where code = 'starter'), 'active'
from public.properties p
where p.organisation_id is not null
  and not exists (select 1 from public.subscriptions s where s.property_id = p.id and s.status in ('pending_payment','active','grace'));

-- Effective entitlement: override -> current plan feature -> Starter feature. After the grace window the
-- property falls back to Starter entitlements; property data is never deleted.
create or replace function public.property_entitlement(p_property_id uuid, p_key text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with cfg as (
    select coalesce((select grace_period_days from public.platform_billing_settings limit 1), 7) as g
  ), live as (
    select s.plan_id, s.entitlement_overrides
    from public.subscriptions s, cfg
    where s.property_id = p_property_id and s.status in ('active','grace')
      and (s.current_period_end is null or now() <= s.current_period_end + make_interval(days => cfg.g))
    order by s.created_at desc limit 1
  ), starter as (select id from public.subscription_plans where code = 'starter')
  select coalesce(
    (select l.entitlement_overrides -> p_key from live l),
    (select case when f.value_int is not null then to_jsonb(f.value_int) else to_jsonb(f.value_bool) end
       from live l join public.plan_features f on f.plan_id = l.plan_id and f.feature_key = p_key),
    (select case when f.value_int is not null then to_jsonb(f.value_int) else to_jsonb(f.value_bool) end
       from starter s join public.plan_features f on f.plan_id = s.id and f.feature_key = p_key)
  )
$$;
revoke all on function public.property_entitlement(uuid, text) from public, anon;
grant execute on function public.property_entitlement(uuid, text) to authenticated, service_role;

create or replace function public.enforce_media_entitlements()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_limit integer; v_count integer;
begin
  if auth.uid() is null or public.is_administrator() then return new; end if;
  if new.media_type = 'image' and new.is_active then
    v_limit := (public.property_entitlement(new.property_id, 'photo_limit') #>> '{}')::integer;
    if v_limit is not null then
      select count(*) into v_count from public.property_media
      where property_id = new.property_id and media_type = 'image' and is_active;
      if v_count >= v_limit then raise exception 'Photo limit reached for this plan (% photos)', v_limit; end if;
    end if;
  end if;
  if new.media_type = 'video' and new.source = 'upload'
     and not coalesce((public.property_entitlement(new.property_id, 'video_direct_upload') #>> '{}')::boolean, false) then
    raise exception 'Direct video upload is not included in this plan. Add an external video link instead.';
  end if;
  return new;
end;
$$;
drop trigger if exists property_media_entitlements on public.property_media;
create trigger property_media_entitlements before insert on public.property_media
for each row execute function public.enforce_media_entitlements();

-- ---------------------------------------------------------------------------
-- 4. Promotions: pricing, placement inventory, purchases
-- ---------------------------------------------------------------------------
create table if not exists public.promotion_prices (
  id uuid primary key default gen_random_uuid(),
  promotion_type text not null check (promotion_type in ('featured','homepage','city','category')),
  duration_days smallint not null check (duration_days > 0),
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  amount_kobo bigint not null check (amount_kobo > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists promotion_prices_one_active_uidx on public.promotion_prices(promotion_type, duration_days, currency) where is_active;
create trigger promotion_prices_immutable_amount before update on public.promotion_prices for each row execute function public.forbid_price_amount_change();

insert into public.promotion_prices (promotion_type, duration_days, amount_kobo)
select v.t, v.d, v.a from (values
  ('featured',7,300000::bigint), ('featured',30,1000000),     -- N3,000 / N10,000
  ('homepage',7,750000),         ('homepage',30,2500000)      -- N7,500 / N25,000
) as v(t, d, a)
where not exists (select 1 from public.promotion_prices x where x.promotion_type = v.t and x.duration_days = v.d and x.is_active);
-- City and category promotions are "from N5,000" in the playbook with no stated duration, so no row is seeded.

create table if not exists public.promotional_inventory (
  id uuid primary key default gen_random_uuid(),
  slot_type text not null check (slot_type in ('featured','homepage','city','category')),
  target_location_id uuid references public.location_nodes(id) on delete restrict,
  target_category_slug text references public.accommodation_categories(slug) on update cascade on delete restrict,
  slot_number smallint not null check (slot_number >= 1),
  label text not null default '' check (length(label) <= 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (slot_type <> 'city' or (target_location_id is not null and target_category_slug is null)),
  check (slot_type <> 'category' or (target_category_slug is not null and target_location_id is null)),
  check (slot_type in ('city','category') or (target_location_id is null and target_category_slug is null))
);
create unique index if not exists promotional_inventory_slot_uidx on public.promotional_inventory
  (slot_type, coalesce(target_location_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(target_category_slug, ''), slot_number);
create index if not exists promotional_inventory_location_idx on public.promotional_inventory(target_location_id) where target_location_id is not null;
create index if not exists promotional_inventory_category_idx on public.promotional_inventory(target_category_slug) where target_category_slug is not null;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  organisation_id uuid not null references public.provider_organisations(id) on delete restrict,
  promotion_type text not null check (promotion_type in ('featured','homepage','city','category')),
  target_location_id uuid references public.location_nodes(id) on delete restrict,
  target_category_slug text references public.accommodation_categories(slug) on update cascade on delete restrict,
  inventory_id uuid references public.promotional_inventory(id) on delete restrict,
  duration_days smallint not null check (duration_days > 0),
  price_kobo bigint not null check (price_kobo >= 0),       -- server-validated snapshot at purchase time
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in
    ('draft','awaiting_payment','paid','pending_approval','approved','scheduled','active','expired','rejected','cancelled','refunded')),
  starts_at timestamptz,
  ends_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (promotion_type <> 'city' or (target_location_id is not null and target_category_slug is null)),
  check (promotion_type <> 'category' or (target_category_slug is not null and target_location_id is null)),
  check (promotion_type in ('city','category') or (target_location_id is null and target_category_slug is null)),
  check (starts_at is null or ends_at is null or ends_at > starts_at),
  check (status in ('draft','rejected','cancelled') or (starts_at is not null and ends_at is not null)),
  check (status not in ('approved','scheduled','active') or (approved_by is not null and approved_at is not null))
);
create index if not exists promotions_property_idx on public.promotions(property_id, status);
create index if not exists promotions_org_idx on public.promotions(organisation_id, created_at desc);
create index if not exists promotions_live_idx on public.promotions(promotion_type, starts_at, ends_at) where status in ('approved','scheduled','active');
create index if not exists promotions_location_idx on public.promotions(target_location_id) where target_location_id is not null;
create index if not exists promotions_category_idx on public.promotions(target_category_slug) where target_category_slug is not null;
create index if not exists promotions_inventory_idx on public.promotions(inventory_id) where inventory_id is not null;
create index if not exists promotions_approved_by_idx on public.promotions(approved_by) where approved_by is not null;
create trigger promotions_touch before update on public.promotions for each row execute function public.set_updated_at();

-- Exclusive slots cannot overlap in time, from the moment payment is awaited until the promotion ends.
-- Stale 'awaiting_payment' holds must be released by a scheduled job (Prompt 15).
alter table public.promotions drop constraint if exists promotions_no_overlap_per_slot;
alter table public.promotions add constraint promotions_no_overlap_per_slot
  exclude using gist (inventory_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (inventory_id is not null and status in ('awaiting_payment','paid','pending_approval','approved','scheduled','active'));

-- ---------------------------------------------------------------------------
-- 5. Payments (platform subscriptions and promotions only), ledger events, webhooks
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.provider_organisations(id) on delete restrict,
  purpose text not null check (purpose in ('subscription','upgrade','renewal','promotion')),
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  promotion_id uuid references public.promotions(id) on delete restrict,
  reference text not null unique check (length(reference) between 8 and 120),
  idempotency_key text unique,
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  amount_kobo bigint not null check (amount_kobo > 0),
  processing_fee_kobo bigint not null default 0 check (processing_fee_kobo >= 0),   -- disclosed separately; paid by the provider
  tax_kobo bigint not null default 0 check (tax_kobo >= 0),
  credit_applied_kobo bigint not null default 0 check (credit_applied_kobo >= 0),
  total_charged_kobo bigint generated always as (amount_kobo + processing_fee_kobo + tax_kobo - credit_applied_kobo) stored,
  status text not null default 'initiated' check (status in ('initiated','pending','succeeded','failed','abandoned','partially_refunded','refunded')),
  channel text,
  paystack_transaction_id text,
  verified_at timestamptz,
  verified_amount_kobo bigint,
  paid_at timestamptz,
  failure_reason text check (failure_reason is null or length(failure_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (credit_applied_kobo <= amount_kobo + processing_fee_kobo + tax_kobo),
  check ((purpose = 'promotion') = (promotion_id is not null)),
  check (purpose = 'promotion' or subscription_id is not null),
  -- Never trust a browser redirect: success requires a server-side verification that matched the expected total.
  check (status not in ('succeeded','partially_refunded','refunded')
         or (verified_at is not null and verified_amount_kobo = amount_kobo + processing_fee_kobo + tax_kobo - credit_applied_kobo and paid_at is not null))
);
create index if not exists subscription_payments_org_idx on public.subscription_payments(organisation_id, created_at desc);
create index if not exists subscription_payments_subscription_idx on public.subscription_payments(subscription_id) where subscription_id is not null;
create index if not exists subscription_payments_promotion_idx on public.subscription_payments(promotion_id) where promotion_id is not null;
create index if not exists subscription_payments_status_idx on public.subscription_payments(status, created_at desc);
create unique index if not exists subscription_payments_paystack_txn_uidx on public.subscription_payments(paystack_transaction_id) where paystack_transaction_id is not null;
create trigger subscription_payments_touch before update on public.subscription_payments for each row execute function public.set_updated_at();

create or replace function public.forbid_payment_delete()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'Payment records cannot be deleted'; end;
$$;
create trigger subscription_payments_no_delete before delete on public.subscription_payments for each row execute function public.forbid_payment_delete();

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.subscription_payments(id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.]{2,59}$'),
  from_status text,
  to_status text,
  source text not null check (source in ('checkout','verify','webhook','admin','job')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists payment_events_payment_idx on public.payment_events(payment_id, created_at);
create trigger payment_events_append_only before update or delete on public.payment_events for each row execute function public.prevent_row_mutation();

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack' check (provider in ('paystack')),
  dedupe_key text not null check (length(dedupe_key) between 8 and 200),   -- e.g. sha256(raw body); duplicate deliveries collapse
  event_type text not null check (length(event_type) <= 80),
  signature_valid boolean not null,
  payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  error text check (error is null or length(error) <= 1000),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, dedupe_key)
);
create index if not exists webhook_events_status_idx on public.webhook_events(processing_status, received_at);
comment on table public.webhook_events is 'Raw provider deliveries. Written only by server code. Only events with signature_valid = true may change payment state.';

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.subscription_payments(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  status text not null default 'requested' check (status in ('requested','approved','processing','succeeded','rejected','failed')),
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  paystack_refund_reference text unique,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  processed_at timestamptz,
  check (status not in ('approved','processing','succeeded','rejected') or decided_by is not null)
);
create index if not exists refunds_payment_idx on public.refunds(payment_id);
create index if not exists refunds_requested_by_idx on public.refunds(requested_by) where requested_by is not null;
create index if not exists refunds_decided_by_idx on public.refunds(decided_by) where decided_by is not null;

create or replace function public.check_refund_total()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_total bigint; v_status text; v_refunded bigint;
begin
  select total_charged_kobo, status into v_total, v_status from public.subscription_payments where id = new.payment_id for update;
  if v_status is null or v_status not in ('succeeded','partially_refunded') then
    raise exception 'Only a succeeded payment can be refunded';
  end if;
  if new.status not in ('rejected','failed') then
    select coalesce(sum(amount_kobo), 0) into v_refunded from public.refunds
    where payment_id = new.payment_id and status not in ('rejected','failed') and id is distinct from new.id;
    if v_refunded + new.amount_kobo > v_total then raise exception 'Refunds would exceed the amount paid'; end if;
  end if;
  return new;
end;
$$;
create trigger refunds_total_guard before insert or update of amount_kobo, status on public.refunds
for each row execute function public.check_refund_total();

-- Promotions may only be paid-for states after a verified successful payment (service_role is exempt).
create or replace function public.guard_promotion_payment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;
  if new.status in ('paid','pending_approval','approved','scheduled','active')
     and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and not exists (select 1 from public.subscription_payments p where p.promotion_id = new.id and p.status = 'succeeded') then
    raise exception 'A promotion cannot proceed without a verified successful payment';
  end if;
  return new;
end;
$$;
create trigger promotions_payment_guard before insert or update of status on public.promotions
for each row execute function public.guard_promotion_payment();

-- ---------------------------------------------------------------------------
-- 6. Invoices and receipts (a receipt is a paid invoice linked to its payment)
-- ---------------------------------------------------------------------------
create sequence if not exists public.invoice_number_seq;
create or replace function public.next_invoice_number()
returns text language sql volatile set search_path = public, pg_temp as $$
  select 'HN-' || to_char(now() at time zone 'utc', 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')
$$;
revoke all on function public.next_invoice_number() from public, anon, authenticated;
grant execute on function public.next_invoice_number() to service_role;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default public.next_invoice_number(),
  organisation_id uuid not null references public.provider_organisations(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  promotion_id uuid references public.promotions(id) on delete restrict,
  payment_id uuid references public.subscription_payments(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','issued','paid','void','refunded')),
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  processing_fee_kobo bigint not null default 0 check (processing_fee_kobo >= 0),
  tax_kobo bigint not null default 0 check (tax_kobo >= 0),
  total_kobo bigint not null check (total_kobo >= 0),
  tax_rate_basis_points integer check (tax_rate_basis_points is null or tax_rate_basis_points between 0 and 10000),   -- snapshot
  billing_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(billing_snapshot) = 'object'),
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (total_kobo = subtotal_kobo + processing_fee_kobo + tax_kobo),
  check (status = 'draft' or issued_at is not null),
  check (status <> 'paid' or (paid_at is not null and payment_id is not null))
);
create index if not exists invoices_org_idx on public.invoices(organisation_id, created_at desc);
create index if not exists invoices_subscription_idx on public.invoices(subscription_id) where subscription_id is not null;
create index if not exists invoices_promotion_idx on public.invoices(promotion_id) where promotion_id is not null;
create index if not exists invoices_payment_idx on public.invoices(payment_id) where payment_id is not null;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  description text not null check (length(trim(description)) between 1 and 300),
  quantity integer not null default 1 check (quantity >= 1),
  unit_amount_kobo bigint not null check (unit_amount_kobo >= 0),
  amount_kobo bigint generated always as (quantity::bigint * unit_amount_kobo) stored
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

create or replace function public.invoices_freeze_after_issue()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status <> 'draft' and (
       new.invoice_number, new.organisation_id, new.currency, new.subtotal_kobo,
       new.processing_fee_kobo, new.tax_kobo, new.total_kobo, new.issued_at
     ) is distinct from (
       old.invoice_number, old.organisation_id, old.currency, old.subtotal_kobo,
       old.processing_fee_kobo, old.tax_kobo, old.total_kobo, old.issued_at) then
    raise exception 'An issued invoice cannot be edited. Void it and issue a new one.';
  end if;
  return new;
end;
$$;
create trigger invoices_freeze before update on public.invoices for each row execute function public.invoices_freeze_after_issue();

create or replace function public.invoice_items_draft_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_status text;
begin
  select status into v_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status is distinct from 'draft' then raise exception 'Items can only change while the invoice is a draft'; end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_items_draft_guard before insert or update or delete on public.invoice_items
for each row execute function public.invoice_items_draft_only();

-- ---------------------------------------------------------------------------
-- 7. Audit
-- ---------------------------------------------------------------------------
create trigger subscription_plans_audit after insert or update or delete on public.subscription_plans for each row execute function public.audit_row_change();
create trigger plan_prices_audit after insert or update or delete on public.plan_prices for each row execute function public.audit_row_change();
create trigger plan_features_audit after insert or update or delete on public.plan_features for each row execute function public.audit_row_change();
create trigger subscriptions_audit after insert or update or delete on public.subscriptions for each row execute function public.audit_row_change();
create trigger promotion_prices_audit after insert or update or delete on public.promotion_prices for each row execute function public.audit_row_change();
create trigger promotional_inventory_audit after insert or update or delete on public.promotional_inventory for each row execute function public.audit_row_change();
create trigger promotions_audit after insert or update or delete on public.promotions for each row execute function public.audit_row_change();
create trigger refunds_audit after insert or update or delete on public.refunds for each row execute function public.audit_row_change();
create trigger invoices_audit after update or delete on public.invoices for each row execute function public.audit_row_change();
create trigger platform_billing_settings_audit after update on public.platform_billing_settings for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 8. RLS and grants. Providers can read their own billing records; every write is server-side
--    (service_role) or an administrator action. No payment, webhook or refund row is writable from the browser.
-- ---------------------------------------------------------------------------
alter table public.platform_billing_settings enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.promotion_prices enable row level security;
alter table public.promotional_inventory enable row level security;
alter table public.promotions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.refunds enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

revoke all on public.platform_billing_settings, public.subscription_plans, public.plan_prices, public.plan_features,
  public.subscriptions, public.promotion_prices, public.promotional_inventory, public.promotions,
  public.subscription_payments, public.payment_events, public.webhook_events, public.refunds,
  public.invoices, public.invoice_items from anon, authenticated;
grant all on public.platform_billing_settings, public.subscription_plans, public.plan_prices, public.plan_features,
  public.subscriptions, public.promotion_prices, public.promotional_inventory, public.promotions,
  public.subscription_payments, public.payment_events, public.webhook_events, public.refunds,
  public.invoices, public.invoice_items to service_role;
revoke update, delete, truncate on public.payment_events from service_role;
revoke delete, truncate on public.subscription_payments, public.invoices from service_role;

-- Public pricing page
grant select on public.subscription_plans, public.plan_prices, public.plan_features to anon, authenticated;
create policy "Public reads public plans" on public.subscription_plans for select to anon, authenticated using ((is_public and is_active) or public.is_administrator());
create policy "Public reads active prices" on public.plan_prices for select to anon, authenticated
  using ((is_active and exists (select 1 from public.subscription_plans p where p.id = plan_id and p.is_public and p.is_active)) or public.is_administrator());
create policy "Public reads plan features" on public.plan_features for select to anon, authenticated
  using (exists (select 1 from public.subscription_plans p where p.id = plan_id and p.is_public and p.is_active) or public.is_administrator());
grant insert, update on public.subscription_plans, public.plan_features to authenticated;
grant insert on public.plan_prices to authenticated;
grant update (is_active, effective_to, paystack_plan_code) on public.plan_prices to authenticated;
create policy "Administrators write plans" on public.subscription_plans for insert to authenticated with check (public.is_administrator());
create policy "Administrators update plans" on public.subscription_plans for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators write plan features" on public.plan_features for insert to authenticated with check (public.is_administrator());
create policy "Administrators update plan features" on public.plan_features for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators write prices" on public.plan_prices for insert to authenticated with check (public.is_administrator());
create policy "Administrators update prices" on public.plan_prices for update to authenticated using (public.is_administrator()) with check (public.is_administrator());

grant select on public.platform_billing_settings to authenticated;
grant update (grace_period_days, payment_retry_days, tax_label, tax_rate_basis_points, processing_fee_note, updated_by) on public.platform_billing_settings to authenticated;
create policy "Signed-in users read billing settings" on public.platform_billing_settings for select to authenticated using (true);
create policy "Administrators update billing settings" on public.platform_billing_settings for update to authenticated using (public.is_administrator()) with check (public.is_administrator());

grant select on public.subscriptions, public.promotions, public.subscription_payments, public.refunds, public.invoices, public.invoice_items, public.payment_events, public.webhook_events to authenticated;
create policy "Members read own subscriptions" on public.subscriptions for select to authenticated using (public.is_provider_member(organisation_id) or public.is_administrator());
create policy "Members read own promotions" on public.promotions for select to authenticated using (public.is_provider_member(organisation_id) or public.is_administrator());
create policy "Owners read own payments" on public.subscription_payments for select to authenticated using (public.is_provider_owner(organisation_id) or public.is_administrator());
create policy "Owners read own refunds" on public.refunds for select to authenticated
  using (public.is_administrator() or exists (select 1 from public.subscription_payments p where p.id = payment_id and public.is_provider_owner(p.organisation_id)));
create policy "Owners read own invoices" on public.invoices for select to authenticated using (public.is_provider_owner(organisation_id) or public.is_administrator());
create policy "Owners read own invoice items" on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and (public.is_provider_owner(i.organisation_id) or public.is_administrator())));
create policy "Administrators read payment events" on public.payment_events for select to authenticated using (public.is_administrator());
create policy "Administrators read webhook events" on public.webhook_events for select to authenticated using (public.is_administrator());

grant select on public.promotion_prices, public.promotional_inventory to authenticated;
create policy "Signed-in users read promotion prices" on public.promotion_prices for select to authenticated using (is_active or public.is_administrator());
create policy "Signed-in users read inventory" on public.promotional_inventory for select to authenticated using (is_active or public.is_administrator());
grant insert, update on public.promotion_prices, public.promotional_inventory, public.promotions, public.refunds to authenticated;
create policy "Administrators write promotion prices" on public.promotion_prices for insert to authenticated with check (public.is_administrator());
create policy "Administrators update promotion prices" on public.promotion_prices for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators write inventory" on public.promotional_inventory for insert to authenticated with check (public.is_administrator());
create policy "Administrators update inventory" on public.promotional_inventory for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators write promotions" on public.promotions for insert to authenticated with check (public.is_administrator());
create policy "Administrators update promotions" on public.promotions for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators write refunds" on public.refunds for insert to authenticated with check (public.is_administrator());
create policy "Administrators update refunds" on public.refunds for update to authenticated using (public.is_administrator()) with check (public.is_administrator());

-- Public, label-as-sponsored projection. Paid placement is kept separate from organic ranking.
create or replace view public.active_promotions with (security_barrier = true) as
select pr.id, pr.property_id, pr.promotion_type, pr.target_location_id, pr.target_category_slug,
       pr.inventory_id, pr.starts_at, pr.ends_at
from public.promotions pr
join public.properties p on p.id = pr.property_id
where pr.status in ('approved','scheduled','active')
  and pr.starts_at <= now() and pr.ends_at > now()
  and p.approval_status = 'approved' and p.is_active;
grant select on public.active_promotions to anon, authenticated;
