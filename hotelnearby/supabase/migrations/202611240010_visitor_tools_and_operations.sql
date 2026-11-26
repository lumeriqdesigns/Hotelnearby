-- Prompt 13 / migration 010: visitor tools, enquiry hardening, newsletter, notifications, support.
-- STATUS: PROPOSED. Not applied anywhere. Requires 008 and 009.
-- Additive only. No existing column is dropped or retyped.

-- ---------------------------------------------------------------------------
-- 1. Enquiries: add what the provider inbox, abuse control and retention need.
--    property_enquiries stays the physical table (entity "enquiries"). An enquiry is NOT a booking.
-- ---------------------------------------------------------------------------
alter table public.property_enquiries
  add column if not exists organisation_id uuid references public.provider_organisations(id) on delete restrict,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists source_path text check (source_path is null or length(source_path) <= 300),
  add column if not exists client_hash text check (client_hash is null or length(client_hash) <= 128),
  add column if not exists read_at timestamptz,
  add column if not exists closed_at timestamptz;
comment on column public.property_enquiries.client_hash is 'Server-side keyed hash of network identifier for rate limiting. Never store a raw IP address here.';

create or replace function public.property_enquiries_set_organisation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select organisation_id into new.organisation_id from public.properties where id = new.property_id;
  return new;
end;
$$;
drop trigger if exists property_enquiries_set_org on public.property_enquiries;
create trigger property_enquiries_set_org before insert on public.property_enquiries
for each row execute function public.property_enquiries_set_organisation();

update public.property_enquiries e set organisation_id = p.organisation_id
from public.properties p where p.id = e.property_id and e.organisation_id is null and p.organisation_id is not null;

create index if not exists property_enquiries_org_status_idx on public.property_enquiries(organisation_id, status, created_at desc) where organisation_id is not null;
create index if not exists property_enquiries_user_idx on public.property_enquiries(user_id) where user_id is not null;
create index if not exists property_enquiries_client_idx on public.property_enquiries(client_hash, created_at desc) where client_hash is not null;

-- ---------------------------------------------------------------------------
-- 2. Saved properties / wishlists, recently viewed, comparisons (signed-in users only;
--    anonymous visitors keep these in browser storage per Prompt 18).
-- ---------------------------------------------------------------------------
create table if not exists public.saved_properties (
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  list_name text not null default 'Saved' check (length(trim(list_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (user_id, list_name, property_id)
);
create index if not exists saved_properties_property_idx on public.saved_properties(property_id);

create or replace function public.limit_saved_properties()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.saved_properties where user_id = new.user_id) >= 200 then
    raise exception 'Saved property limit reached';
  end if;
  return new;
end;
$$;
drop trigger if exists saved_properties_limit on public.saved_properties;
create trigger saved_properties_limit before insert on public.saved_properties
for each row execute function public.limit_saved_properties();

create table if not exists public.recently_viewed (
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count >= 1),
  primary key (user_id, property_id)
);
create index if not exists recently_viewed_user_idx on public.recently_viewed(user_id, viewed_at desc);
create index if not exists recently_viewed_property_idx on public.recently_viewed(property_id);

-- Only approved, active listings can be recorded; keeps the 30 most recent per user.
create or replace function public.touch_recently_viewed(p_property_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.properties where id = p_property_id and approval_status = 'approved' and is_active) then
    return false;
  end if;
  insert into public.recently_viewed (user_id, property_id) values (auth.uid(), p_property_id)
  on conflict (user_id, property_id) do update set viewed_at = now(), view_count = public.recently_viewed.view_count + 1;
  delete from public.recently_viewed rv
  where rv.user_id = auth.uid()
    and rv.property_id in (
      select property_id from public.recently_viewed where user_id = auth.uid()
      order by viewed_at desc offset 30
    );
  return true;
end;
$$;
revoke all on function public.touch_recently_viewed(uuid) from public, anon;
grant execute on function public.touch_recently_viewed(uuid) to authenticated;

create table if not exists public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My comparison' check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comparisons_user_idx on public.comparisons(user_id, updated_at desc);
create table if not exists public.comparison_items (
  comparison_id uuid not null references public.comparisons(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  position smallint not null check (position between 1 and 3),   -- "compare up to three properties"
  created_at timestamptz not null default now(),
  primary key (comparison_id, property_id),
  unique (comparison_id, position)
);
create index if not exists comparison_items_property_idx on public.comparison_items(property_id);
create trigger comparisons_touch before update on public.comparisons for each row execute function public.set_updated_at();

alter table public.saved_properties enable row level security;
alter table public.recently_viewed enable row level security;
alter table public.comparisons enable row level security;
alter table public.comparison_items enable row level security;
revoke all on public.saved_properties, public.recently_viewed, public.comparisons, public.comparison_items from anon, authenticated;
grant select, insert, delete on public.saved_properties to authenticated;
grant select, delete on public.recently_viewed to authenticated;          -- writes go through touch_recently_viewed()
grant select, insert, update, delete on public.comparisons, public.comparison_items to authenticated;
grant all on public.saved_properties, public.recently_viewed, public.comparisons, public.comparison_items to service_role;
create policy "Users read own saved properties" on public.saved_properties for select to authenticated using (user_id = auth.uid());
create policy "Users save approved properties" on public.saved_properties for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.properties p where p.id = property_id and p.approval_status = 'approved' and p.is_active));
create policy "Users remove own saved properties" on public.saved_properties for delete to authenticated using (user_id = auth.uid());
create policy "Users read own recently viewed" on public.recently_viewed for select to authenticated using (user_id = auth.uid());
create policy "Users clear own recently viewed" on public.recently_viewed for delete to authenticated using (user_id = auth.uid());
create policy "Users manage own comparisons" on public.comparisons for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage items of own comparisons" on public.comparison_items for all to authenticated
  using (exists (select 1 from public.comparisons c where c.id = comparison_id and c.user_id = auth.uid()))
  with check (
    exists (select 1 from public.comparisons c where c.id = comparison_id and c.user_id = auth.uid())
    and exists (select 1 from public.properties p where p.id = property_id and p.approval_status = 'approved' and p.is_active)
  );

-- ---------------------------------------------------------------------------
-- 3. Newsletter: consent, double opt-in and unsubscribe. Token values are never stored, only hashes.
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  status text not null default 'pending' check (status in ('pending','subscribed','unsubscribed','bounced')),
  consent_text_version text not null check (length(consent_text_version) between 1 and 40),
  consent_recorded_at timestamptz not null default now(),
  confirm_token_hash text unique,
  unsubscribe_token_hash text not null unique,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  source text not null default 'website' check (length(source) <= 60),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'subscribed' or confirmed_at is not null),
  check (status <> 'unsubscribed' or unsubscribed_at is not null)
);
create unique index if not exists newsletter_subscribers_email_uidx on public.newsletter_subscribers(email);
create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers(status, created_at desc);
create index if not exists newsletter_subscribers_user_idx on public.newsletter_subscribers(user_id) where user_id is not null;
create trigger newsletter_subscribers_touch before update on public.newsletter_subscribers for each row execute function public.set_updated_at();

create or replace function public.subscribe_newsletter(p_email text, p_consent_text_version text, p_confirm_token_hash text, p_unsubscribe_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'Enter a valid email address'; end if;
  if coalesce(p_confirm_token_hash, '') = '' or coalesce(p_unsubscribe_token_hash, '') = '' then raise exception 'Token hashes are required'; end if;
  insert into public.newsletter_subscribers (email, consent_text_version, confirm_token_hash, unsubscribe_token_hash, user_id)
  values (v_email, p_consent_text_version, p_confirm_token_hash, p_unsubscribe_token_hash, auth.uid())
  on conflict (email) do update
    set status = 'pending', consent_text_version = excluded.consent_text_version, consent_recorded_at = now(),
        confirm_token_hash = excluded.confirm_token_hash, unsubscribed_at = null, confirmed_at = null
    where public.newsletter_subscribers.status in ('pending','unsubscribed');
  return true;  -- always true so the form cannot be used to discover who is subscribed
end;
$$;
create or replace function public.confirm_newsletter(p_confirm_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.newsletter_subscribers
  set status = 'subscribed', confirmed_at = now(), confirm_token_hash = null
  where confirm_token_hash = p_confirm_token_hash and status = 'pending';
  return found;
end;
$$;
create or replace function public.unsubscribe_newsletter(p_unsubscribe_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.newsletter_subscribers
  set status = 'unsubscribed', unsubscribed_at = now(), confirm_token_hash = null
  where unsubscribe_token_hash = p_unsubscribe_token_hash and status <> 'unsubscribed';
  return found;
end;
$$;
revoke all on function public.subscribe_newsletter(text,text,text,text), public.confirm_newsletter(text), public.unsubscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text,text,text,text), public.confirm_newsletter(text), public.unsubscribe_newsletter(text) to anon, authenticated;

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
grant all on public.newsletter_subscribers to service_role;
create policy "Newsletter staff read subscribers" on public.newsletter_subscribers
  for select to authenticated using (public.has_staff_permission('newsletter.manage'));

-- ---------------------------------------------------------------------------
-- 4. Notifications (in-app). Created by server code / SECURITY DEFINER functions only.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid references public.provider_organisations(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z][a-z0-9_.]{2,59}$'),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null default '' check (length(body) <= 1000),
  link_path text check (link_path is null or (link_path like '/%' and length(link_path) <= 300)),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index if not exists notifications_org_idx on public.notifications(organisation_id) where organisation_id is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy "Users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users mark own notifications read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Support tickets (contact, advertising/partnership enquiries, provider and visitor support).
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  requester_id uuid references auth.users(id) on delete set null,
  requester_name text not null check (length(trim(requester_name)) between 2 and 120),
  requester_email text not null check (requester_email = lower(trim(requester_email)) and requester_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  organisation_id uuid references public.provider_organisations(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  category text not null check (category in ('provider_support','visitor_support','advertising','partnership','listing_report','billing','other')),
  subject text not null check (length(trim(subject)) between 3 and 160),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (status not in ('resolved','closed') or closed_at is not null)
);
create index if not exists support_tickets_status_idx on public.support_tickets(status, priority, created_at desc);
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id) where requester_id is not null;
create index if not exists support_tickets_org_idx on public.support_tickets(organisation_id) where organisation_id is not null;
create index if not exists support_tickets_property_idx on public.support_tickets(property_id) where property_id is not null;
create index if not exists support_tickets_assigned_idx on public.support_tickets(assigned_to) where assigned_to is not null;
create trigger support_tickets_touch before update on public.support_tickets for each row execute function public.set_updated_at();

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('requester','staff','system')),
  body text not null check (length(trim(body)) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_internal or author_kind in ('staff','system'))
);
create index if not exists support_ticket_messages_ticket_idx on public.support_ticket_messages(ticket_id, created_at);
create index if not exists support_ticket_messages_author_idx on public.support_ticket_messages(author_id) where author_id is not null;

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_tickets, public.support_ticket_messages from anon, authenticated;
grant select on public.support_tickets, public.support_ticket_messages to authenticated;
grant update (status, priority, assigned_to, closed_at) on public.support_tickets to authenticated;
grant insert on public.support_ticket_messages to authenticated;
grant all on public.support_tickets, public.support_ticket_messages to service_role;
create policy "Requesters, their organisation and support staff read tickets" on public.support_tickets
  for select to authenticated using (
    requester_id = auth.uid()
    or (organisation_id is not null and public.is_provider_member(organisation_id))
    or public.has_staff_permission('support.manage')
  );
create policy "Support staff update tickets" on public.support_tickets
  for update to authenticated using (public.has_staff_permission('support.manage')) with check (public.has_staff_permission('support.manage'));
create policy "Read ticket messages (internal notes staff-only)" on public.support_ticket_messages
  for select to authenticated using (
    public.has_staff_permission('support.manage')
    or (not is_internal and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (t.requester_id = auth.uid() or (t.organisation_id is not null and public.is_provider_member(t.organisation_id)))
    ))
  );
create policy "Reply to own tickets or as support staff" on public.support_ticket_messages
  for insert to authenticated with check (
    author_id = auth.uid() and (
      (public.has_staff_permission('support.manage') and author_kind = 'staff')
      or (author_kind = 'requester' and not is_internal and exists (
        select 1 from public.support_tickets t where t.id = ticket_id and t.requester_id = auth.uid()))
    )
  );
-- Ticket creation (including anonymous contact-form submissions) is a server-side RPC built in Prompt 20,
-- so rate limiting and spam checks live in one place. No direct INSERT is granted on support_tickets.
