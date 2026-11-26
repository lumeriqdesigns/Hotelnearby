-- Hotelnearby schema invariant tests (billing, promotions and Travel Journal CMS). Run on a DEVELOPMENT database after applying the required migrations through 016.
-- Everything runs inside a transaction that is rolled back. Not yet executed: no Postgres was available
-- when this was written. A failing check raises an exception naming the broken rule.
begin;

do $$ declare n int; begin
  -- A. Approved commercial configuration is stored exactly (kobo).
  select count(*) into n from public.plan_prices pp join public.subscription_plans p on p.id = pp.plan_id
   where pp.is_active and (p.code, pp.billing_interval, pp.amount_kobo) in
     (('starter','monthly',0),('starter','annual',0),('professional','monthly',600000),('professional','annual',6000000),
      ('premium','monthly',1000000),('premium','annual',10000000));
  if n <> 6 then raise exception 'A: plan prices differ from the approved configuration (% of 6 match)', n; end if;
  select count(*) into n from public.plan_prices pp join public.subscription_plans p on p.id = pp.plan_id where p.code = 'enterprise';
  if n <> 0 then raise exception 'A: enterprise must have no list price'; end if;
  select count(*) into n from public.promotion_prices where is_active and (promotion_type, duration_days, amount_kobo) in
     (('featured',7,300000),('featured',30,1000000),('homepage',7,750000),('homepage',30,2500000));
  if n <> 4 then raise exception 'A: promotion prices differ from the approved configuration'; end if;

  -- B. Photo limits.
  select count(*) into n from public.plan_features f join public.subscription_plans p on p.id = f.plan_id
   where f.feature_key = 'photo_limit' and (p.code, f.value_int) in (('starter',8),('professional',30),('premium',60));
  if n <> 3 then raise exception 'B: photo limits differ from the approved configuration'; end if;

  -- C. No booking-style objects exist.
  select count(*) into n from information_schema.tables where table_schema = 'public'
   and (table_name ~ '(booking|reservation|availability|calendar|payout|commission|check_in)');
  if n <> 0 then raise exception 'C: booking-style table found - forbidden by the business model'; end if;

  -- D. Every public table has RLS enabled.
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if n <> 0 then raise exception 'D: % public tables have RLS disabled', n; end if;

  -- E. anon has no direct access to personal or financial tables.
  select count(*) into n from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public' and table_name in
     ('profiles','property_enquiries','property_listing_reports','subscriptions','subscription_payments','payment_events',
      'webhook_events','refunds','invoices','invoice_items','newsletter_subscribers','notifications','support_tickets',
      'support_ticket_messages','analytics_events','reviews','verification_records','admin_audit_logs','saved_properties',
      'recently_viewed','comparisons','price_history','ai_listing_drafts','data_retention_policies','support_requests','support_request_events');
  if n <> 0 then raise exception 'E: anon holds % grants on private tables', n; end if;

  -- F. Audit log is append-only.
  insert into public.admin_audit_logs(action, target_type, actor_type) values ('test.row','test','system');
  begin
    update public.admin_audit_logs set reason = 'x' where action = 'test.row';
    raise exception 'F: audit update was allowed';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;
  begin
    delete from public.admin_audit_logs where action = 'test.row';
    raise exception 'F: audit delete was allowed';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  -- G. Money columns are integer kobo, not floating point.
  select count(*) into n from information_schema.columns where table_schema = 'public'
   and table_name in ('subscription_payments','refunds','invoices','invoice_items','plan_prices','promotion_prices','promotions','subscriptions')
   and column_name like '%kobo' and data_type <> 'bigint' and column_name <> 'amount_kobo';
  if n <> 0 then raise exception 'G: a kobo column is not bigint'; end if;

  -- H. Unique-live-subscription rule exists.
  if not exists (select 1 from pg_indexes where indexname = 'subscriptions_one_live_per_property_uidx') then
    raise exception 'H: one-live-subscription-per-property index missing'; end if;

  -- I. Exclusive promotion slots cannot overlap.
  if not exists (select 1 from pg_constraint where conname = 'promotions_no_overlap_per_slot') then
    raise exception 'I: promotion overlap exclusion constraint missing'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.promotions'::regclass and tgname = 'promotions_approval_guard' and not tgisinternal) then
    raise exception 'I2: promotional approval guard missing'; end if;
  if to_regprocedure('public.get_live_promotional_placements(text[],text,text,integer)') is null then
    raise exception 'I3: public sponsored placement projection missing'; end if;
  if to_regprocedure('public.get_promotion_performance(uuid[])') is null then
    raise exception 'I4: aggregated promotion reporting function missing'; end if;

  -- J. A succeeded payment must be server-verified (check constraint present).
  if not exists (select 1 from pg_constraint where conrelid = 'public.subscription_payments'::regclass and contype = 'c'
                 and pg_get_constraintdef(oid) like '%verified_amount_kobo%') then
    raise exception 'J: verified-payment constraint missing'; end if;

  -- L. Travel Journal taxonomy and editorial link tables are present with RLS enabled.
  if to_regclass('public.blog_tags') is null or to_regclass('public.blog_article_tags') is null
     or to_regclass('public.blog_article_destinations') is null or to_regclass('public.blog_article_links') is null then
    raise exception 'L: Travel Journal CMS taxonomy/link tables missing'; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('blog_tags','blog_article_tags','blog_article_destinations','blog_article_links') and c.relrowsecurity;
  if n <> 4 then raise exception 'L: Travel Journal CMS RLS is not enabled on all new tables'; end if;
  select count(*) into n from public.blog_categories where slug in
   ('destination-guides','travel-tips','accommodation-guides','local-experiences','food-restaurants','events-festivals','tourism-culture','budget-travel','family-travel','business-travel');
  if n <> 10 then raise exception 'L: expected ten Travel Journal categories, found %', n; end if;
  if not exists (select 1 from storage.buckets where id = 'journal-images' and public and file_size_limit = 8388608) then
    raise exception 'L: public journal image bucket configuration missing'; end if;

  -- M. Nearby and event directories have moderated records and property relationships.
  if to_regclass('public.attractions') is null or to_regclass('public.local_businesses') is null or to_regclass('public.events') is null
     or to_regclass('public.attraction_related_properties') is null or to_regclass('public.business_related_properties') is null
     or to_regclass('public.event_related_properties') is null then
    raise exception 'M: nearby directory, event, or accommodation relationship tables are missing'; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
   where s.nspname='public' and c.relname in ('attractions','local_businesses','events','attraction_related_properties','business_related_properties','event_related_properties') and c.relrowsecurity;
  if n <> 6 then raise exception 'M: RLS must be enabled on all directory and relationship tables'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.events'::regclass and tgname='events_publication_guard' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgrelid='public.attractions'::regclass and tgname='attractions_publication_guard' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgrelid='public.local_businesses'::regclass and tgname='local_businesses_publication_guard' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgrelid='public.event_related_properties'::regclass and tgname='event_property_link_guard' and not tgisinternal) then
    raise exception 'M: verified-coordinate publication or same-city property-link guard is missing'; end if;

  -- N. Trust workflow tables, audit trail, and atomic verification decision exist with RLS.
  if to_regclass('public.trust_reports') is null or to_regclass('public.trust_disputes') is null or to_regclass('public.trust_audit_events') is null then
    raise exception 'N: trust reports, disputes or audit event table missing'; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
   where s.nspname='public' and c.relname in ('trust_reports','trust_disputes','trust_audit_events') and c.relrowsecurity;
  if n <> 3 then raise exception 'N: RLS missing on trust workflow tables'; end if;
  if to_regprocedure('public.admin_decide_verification_record(uuid,uuid,text,text)') is null then
    raise exception 'N: atomic verification decision function missing'; end if;
  if not exists(select 1 from storage.buckets where id='property-verification' and not public and file_size_limit=10485760) then
    raise exception 'N: private verification evidence bucket missing'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.reviews'::regclass and tgname='reviews_insert_trust_audit' and not tgisinternal) then
    raise exception 'N: review submission audit trigger missing'; end if;

  -- K. Verification is independent of subscriptions: no FK between them.
  select count(*) into n from pg_constraint where contype = 'f'
   and ((conrelid = 'public.verification_records'::regclass and confrelid = 'public.subscriptions'::regclass)
     or (conrelid = 'public.subscriptions'::regclass and confrelid = 'public.verification_records'::regclass));
  if n <> 0 then raise exception 'K: verification and subscriptions must stay independent'; end if;

  -- O. Support intake is RPC-only, private to staff, and has an append-style event history.
  if to_regclass('public.support_requests') is null or to_regclass('public.support_request_events') is null then
    raise exception 'O: support request or support event tables are missing'; end if;
  if has_table_privilege('anon','public.support_requests','INSERT') then
    raise exception 'O: anon must not insert directly into support_requests'; end if;
  if not has_function_privilege('anon','public.submit_public_support_request(text,text,text,text,text,text)','EXECUTE') then
    raise exception 'O: anonymous support intake RPC is not executable'; end if;
  if not exists(select 1 from pg_class c where c.oid='public.support_requests'::regclass and c.relrowsecurity)
     or not exists(select 1 from pg_class c where c.oid='public.support_request_events'::regclass and c.relrowsecurity) then
    raise exception 'O: support tables must have RLS enabled'; end if;
end $$;

rollback;
-- Role-based RLS tests (provider A cannot read provider B enquiries/subscriptions/payments, visitor cannot read
-- other users' saved properties, non-admin cannot approve a listing) need real auth sessions. Run them in the
-- Supabase development project with test accounts per Prompt 22/23; do not mark them passed until executed.

