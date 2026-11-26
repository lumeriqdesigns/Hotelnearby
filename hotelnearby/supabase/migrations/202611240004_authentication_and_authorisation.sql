-- Prompt 9: Supabase Auth profiles, role-based authorisation and RLS.
-- Apply after migrations 001-003. No users, passwords or privileged accounts are seeded.

create type public.platform_role as enum (
  'visitor', 'provider_owner', 'provider_staff', 'administrator', 'editor_moderator'
);
create type public.provider_membership_role as enum ('owner', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text,
  avatar_url text,
  role public.platform_role not null default 'visitor',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.provider_organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.provider_membership_role not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);
create index provider_memberships_user_idx on public.provider_memberships(user_id, organisation_id);

create or replace function public.current_platform_role()
returns public.platform_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() limit 1 $$;

create or replace function public.has_any_platform_role(p_roles public.platform_role[])
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_platform_role() = any(p_roles), false) $$;

create or replace function public.is_provider_member(p_organisation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.provider_memberships m
    where m.organisation_id = p_organisation_id and m.user_id = auth.uid()
  )
$$;

create or replace function public.is_provider_owner(p_organisation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.provider_memberships m
    where m.organisation_id = p_organisation_id and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- Auth metadata is untrusted. Only visitor/provider_owner can be selected at public signup.
-- Administrator/editor_moderator/provider_staff cannot be self-assigned.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested_role text;
  organisation_name text;
  new_organisation_id uuid;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'provider_owner' then 'provider_owner'
    else 'visitor'
  end;
  insert into public.profiles (id, email, full_name, role, email_verified_at)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    requested_role::public.platform_role,
    new.email_confirmed_at
  ) on conflict (id) do nothing;

  if requested_role = 'provider_owner' then
    organisation_name := nullif(trim(left(coalesce(new.raw_user_meta_data ->> 'organisation_name', ''), 160)), '');
    if organisation_name is not null then
      insert into public.provider_organisations (name, owner_user_id)
      values (organisation_name, new.id) returning id into new_organisation_id;
      insert into public.provider_memberships (organisation_id, user_id, role)
      values (new_organisation_id, new.id, 'owner');
    end if;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created_profile
after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.sync_auth_user_email_verification()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
  set email = new.email,
      email_verified_at = new.email_confirmed_at,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_verified
after update of email, email_confirmed_at on auth.users
for each row execute function public.sync_auth_user_email_verification();

create or replace function public.touch_profile_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_profile_updated_at();

-- Provider owner can add an existing account as staff only within their own organisation.
-- An invitation/verification email should be sent before calling this RPC.
create or replace function public.add_provider_staff(p_organisation_id uuid, p_email text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare target_user_id uuid;
begin
  if not public.is_provider_owner(p_organisation_id) then
    raise exception 'Provider owner access required';
  end if;
  select id into target_user_id from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null limit 1;
  if target_user_id is null then return false; end if;
  insert into public.provider_memberships (organisation_id, user_id, role)
  values (p_organisation_id, target_user_id, 'staff')
  on conflict (organisation_id, user_id) do update set role = 'staff';
  update public.profiles set role = 'provider_staff', updated_at = now()
  where id = target_user_id and role in ('visitor', 'provider_staff');
  return true;
end;
$$;

-- Only an existing administrator can grant/revoke platform staff roles.
create or replace function public.set_platform_role(p_user_id uuid, p_role public.platform_role)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_platform_role() is distinct from 'administrator' then
    raise exception 'Administrator access required';
  end if;
  if p_role not in ('visitor', 'administrator', 'editor_moderator') then
    raise exception 'This role must be assigned through provider registration or membership';
  end if;
  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;
  return found;
end;
$$;

alter table public.profiles enable row level security;
alter table public.provider_organisations enable row level security;
alter table public.provider_memberships enable row level security;
revoke all on public.profiles, public.provider_organisations, public.provider_memberships from anon;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant select on public.provider_organisations, public.provider_memberships, public.property_listing_reports, public.property_enquiries to authenticated;
grant insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.property_room_categories, public.property_apartment_units, public.property_media, public.property_nearby_landmarks to authenticated;
revoke all on function public.current_platform_role() from public;
revoke all on function public.has_any_platform_role(public.platform_role[]) from public;
revoke all on function public.is_provider_member(uuid) from public;
revoke all on function public.is_provider_owner(uuid) from public;
revoke all on function public.add_provider_staff(uuid, text) from public;
revoke all on function public.set_platform_role(uuid, public.platform_role) from public;
grant execute on function public.current_platform_role() to authenticated;
grant execute on function public.has_any_platform_role(public.platform_role[]) to authenticated;
grant execute on function public.is_provider_member(uuid) to authenticated;
grant execute on function public.is_provider_owner(uuid) to authenticated;
grant execute on function public.add_provider_staff(uuid, text) to authenticated;
grant execute on function public.set_platform_role(uuid, public.platform_role) to authenticated;

create policy "Users read own profile or platform staff read all" on public.profiles
for select to authenticated using (
  id = auth.uid() or public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[])
);
create policy "Users update own non-role profile fields" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Provider members read their organisations" on public.provider_organisations
for select to authenticated using (public.is_provider_member(id));
create policy "Provider members read their memberships" on public.provider_memberships
for select to authenticated using (user_id = auth.uid() or public.is_provider_member(organisation_id));

-- Keep existing destination admin policies aligned with the database role table,
-- rather than trusting editable user metadata or frontend role flags.
drop policy if exists "Admins manage location hierarchy" on public.location_nodes;
create policy "Admins manage location hierarchy" on public.location_nodes
for all to authenticated using (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]))
with check (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]));
drop policy if exists "Admins manage destination profiles" on public.destination_profiles;
create policy "Admins manage destination profiles" on public.destination_profiles
for all to authenticated using (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]))
with check (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]));
drop policy if exists "Admins manage destination content" on public.destination_content_items;
create policy "Admins manage destination content" on public.destination_content_items
for all to authenticated using (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]))
with check (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]));
drop policy if exists "Admins read destination quality metrics" on public.destination_quality_metrics;
create policy "Admins read destination quality metrics" on public.destination_quality_metrics
for select to authenticated using (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]));
drop policy if exists "Admins manage publication rules" on public.destination_publication_rules;
create policy "Admins manage publication rules" on public.destination_publication_rules
for all to authenticated using (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]))
with check (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]));

-- Provider owners/staff can manage only properties belonging to their organisation.
create policy "Providers manage their own properties" on public.properties
for all to authenticated
using (organisation_id is not null and public.is_provider_member(organisation_id))
with check (organisation_id is not null and public.is_provider_member(organisation_id));
create policy "Platform staff manage properties" on public.properties
for all to authenticated
using (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]))
with check (public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[]));

-- Provider ownership is not permission to approve or verify a listing.
create or replace function public.guard_provider_listing_approval()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and public.current_platform_role() in ('provider_owner','provider_staff') then
    if tg_op = 'INSERT' then
      if new.approval_status <> 'draft' or new.verification_status <> 'unverified' then
        raise exception 'New provider listings must start as draft and unverified';
      end if;
    else
      if new.approval_status is distinct from old.approval_status
        and not (old.approval_status = 'draft' and new.approval_status = 'pending_review') then
        raise exception 'Only platform moderators can approve, reject or suspend listings';
      end if;
      if new.verification_status is distinct from old.verification_status then
        raise exception 'Only platform moderators can change verification status';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger properties_guard_provider_approval
before insert or update on public.properties
for each row execute function public.guard_provider_listing_approval();

-- Child listing records remain private to providers; public pages use the approved-only RPC.
create policy "Providers manage own room categories" on public.property_room_categories
for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
);
create policy "Providers manage own apartment units" on public.property_apartment_units
for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
);
create policy "Providers manage own media" on public.property_media
for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
);
create policy "Providers manage own nearby landmarks" on public.property_nearby_landmarks
for all to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
) with check (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
);

-- Staff can read/manage only enquiries for properties they belong to.
create policy "Providers read own enquiries" on public.property_enquiries
for select to authenticated using (
  exists (select 1 from public.properties p where p.id = property_id and public.is_provider_member(p.organisation_id))
);
create policy "Platform moderators read listing reports" on public.property_listing_reports
for select to authenticated using (
  public.has_any_platform_role(array['administrator','editor_moderator']::public.platform_role[])
);
