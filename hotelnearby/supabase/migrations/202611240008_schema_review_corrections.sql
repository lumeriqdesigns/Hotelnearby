-- Prompt 13 / migration 008: corrections found while reviewing migrations 001-007.
-- STATUS: PROPOSED. Not applied anywhere. Apply to a development project first, then staging.
-- Contains NO data deletion. Every statement either adds an object, replaces a function body,
-- or tightens a policy/trigger. Behavioural changes are listed in docs/database/migration-report.md (section 4).
-- Run supabase/preflight/001_read_only_checks.sql first.

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_administrator()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.current_platform_role() = 'administrator', false)
$$;
revoke all on function public.is_administrator() from public;
grant execute on function public.is_administrator() to authenticated, service_role;

-- Administrator, or an active editor/moderator holding the named staff permission.
create or replace function public.has_staff_permission(p_permission_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_administrator() or exists (
    select 1 from public.platform_permission_grants g
    where g.user_id = auth.uid()
      and g.permission_key = p_permission_key
      and public.current_platform_role() = 'editor_moderator'
  )
$$;
revoke all on function public.has_staff_permission(text) from public;
grant execute on function public.has_staff_permission(text) to authenticated, service_role;

-- The permission list in 007 only allows six keys. Review moderation and verification need two more.
alter table public.platform_permission_grants drop constraint if exists platform_permission_grants_permission_key_check;
alter table public.platform_permission_grants add constraint platform_permission_grants_permission_key_check
  check (permission_key in ('destinations.manage','content.manage','events.manage','support.manage',
                            'newsletter.manage','reports.view','reviews.moderate','verification.review'));

create or replace function public.admin_set_permission_grant(p_user_id uuid, p_permission_key text, p_granted boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare target_role public.platform_role;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_permission_key not in ('destinations.manage','content.manage','events.manage','support.manage','newsletter.manage','reports.view','reviews.moderate','verification.review') then raise exception 'Invalid permission'; end if;
  select role into target_role from public.profiles where id=p_user_id and account_status='active';
  if target_role is distinct from 'editor_moderator' then raise exception 'Permissions can only be assigned to active editor/moderator accounts'; end if;
  if p_granted then
    insert into public.platform_permission_grants(user_id,permission_key,granted_by)
    values(p_user_id,p_permission_key,auth.uid()) on conflict(user_id,permission_key) do nothing;
  else
    delete from public.platform_permission_grants where user_id=p_user_id and permission_key=p_permission_key;
  end if;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,reason,before_state,after_state)
  values(auth.uid(),case when p_granted then 'permission.granted' else 'permission.revoked' end,
    'profile',p_user_id::text,p_permission_key,'{}'::jsonb,jsonb_build_object('permission_key',p_permission_key,'granted',p_granted));
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. SECURITY: approval/organisation guards must apply to everyone who is not an administrator.
--    007 only restricted users whose profile role is provider_owner/provider_staff. A member whose
--    profile role is visitor or editor_moderator (reachable via set_platform_role, or by accepting an
--    invitation while holding editor_moderator) kept RLS access through membership but skipped the guard,
--    so could set approval_status='approved' on their own listing.
--    auth.uid() is null for service_role/maintenance connections, which remain unrestricted.
-- ---------------------------------------------------------------------------
create or replace function public.guard_provider_listing_approval()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and public.current_platform_role() is distinct from 'administrator' then
    if tg_op = 'INSERT' then
      if new.approval_status <> 'draft' or new.verification_status <> 'unverified' then
        raise exception 'New provider listings must start as draft and unverified';
      end if;
    else
      if new.approval_status is distinct from old.approval_status
        and not (old.approval_status in ('draft','rejected','correction_requested','approved') and new.approval_status = 'pending_review') then
        raise exception 'Only administrators can approve, reject or suspend listings';
      end if;
      if new.verification_status is distinct from old.verification_status
        or new.moderation_note is distinct from old.moderation_note
        or new.moderated_by is distinct from old.moderated_by
        or new.moderated_at is distinct from old.moderated_at
        or new.verification_note is distinct from old.verification_note
        or new.verification_reviewed_by is distinct from old.verification_reviewed_by
        or new.verification_reviewed_at is distinct from old.verification_reviewed_at then
        raise exception 'Only administrators can change moderation or verification records';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_provider_property_organisation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and public.current_platform_role() is distinct from 'administrator' then
    if new.organisation_id is null or not public.is_provider_member(new.organisation_id) then
      raise exception 'You can only manage properties belonging to your organisation';
    end if;
    if tg_op = 'UPDATE' and new.organisation_id is distinct from old.organisation_id then
      raise exception 'A property cannot be transferred between organisations';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Listing status state machine (applies to administrators too; service_role may repair data).
--    007's admin_moderate_property could approve a draft the provider never submitted, or "reinstate"
--    a rejected listing. Reinstate is only meaningful from 'suspended'.
-- ---------------------------------------------------------------------------
create or replace function public.guard_property_status_transition()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or new.approval_status is not distinct from old.approval_status then
    return new;
  end if;
  if not (
    (old.approval_status = 'draft'                and new.approval_status = 'pending_review') or
    (old.approval_status = 'pending_review'       and new.approval_status in ('approved','rejected','correction_requested','suspended')) or
    (old.approval_status = 'correction_requested' and new.approval_status in ('pending_review','suspended')) or
    (old.approval_status = 'rejected'             and new.approval_status = 'pending_review') or
    (old.approval_status = 'approved'             and new.approval_status in ('pending_review','suspended')) or
    (old.approval_status = 'suspended'            and new.approval_status = 'approved')
  ) then
    raise exception 'Invalid listing status change from % to %', old.approval_status, new.approval_status;
  end if;
  return new;
end;
$$;
drop trigger if exists properties_status_transition_guard on public.properties;
create trigger properties_status_transition_guard before update of approval_status on public.properties
for each row execute function public.guard_property_status_transition();

-- ---------------------------------------------------------------------------
-- 3. Honest public price date. 003's trigger fired only when price columns were in the SET list, so a
--    provider could update price_updated_at directly and make a stale price look current.
-- ---------------------------------------------------------------------------
create or replace function public.set_public_price_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      if new.price_amount is not null and new.price_updated_at is null then new.price_updated_at := now(); end if;
    else
      new.price_updated_at := case when new.price_amount is not null then now() else null end;
    end if;
  else
    if new.price_amount is distinct from old.price_amount or new.price_basis is distinct from old.price_basis then
      new.price_updated_at := now();
    elsif auth.uid() is not null then
      new.price_updated_at := old.price_updated_at;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists properties_price_updated_at on public.properties;
create trigger properties_price_updated_at before insert or update on public.properties
for each row execute function public.set_public_price_updated_at();
drop trigger if exists room_categories_price_updated_at on public.property_room_categories;
create trigger room_categories_price_updated_at before insert or update on public.property_room_categories
for each row execute function public.set_public_price_updated_at();
drop trigger if exists apartment_units_price_updated_at on public.property_apartment_units;
create trigger apartment_units_price_updated_at before insert or update on public.property_apartment_units
for each row execute function public.set_public_price_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Protect enquiry/report evidence from cascade deletion.
--    The app (deletePropertyAction) hard-deletes properties; FK cascades would silently remove
--    enquiries, listing reports, media and (later) price history. Drafts with no recorded activity
--    can still be deleted, which keeps the current dashboard behaviour for abandoned drafts.
--    service_role (auth.uid() is null) is unaffected so retention jobs keep working.
-- ---------------------------------------------------------------------------
create or replace function public.guard_property_delete()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return old; end if;
  if old.approval_status <> 'draft' then
    raise exception 'Only draft listings can be deleted. Suspend or archive a listing that has been submitted.';
  end if;
  if exists (select 1 from public.property_enquiries where property_id = old.id)
     or exists (select 1 from public.property_listing_reports where property_id = old.id) then
    raise exception 'This listing has enquiry or report history and cannot be deleted.';
  end if;
  return old;
end;
$$;
drop trigger if exists properties_guard_delete on public.properties;
create trigger properties_guard_delete before delete on public.properties
for each row execute function public.guard_property_delete();

-- ---------------------------------------------------------------------------
-- 5. Staff can no longer be inserted directly. add_provider_staff() and accept_provider_invitation()
--    (both SECURITY DEFINER) remain the only paths, so the verified-email and consent rules in
--    005 cannot be bypassed by writing arbitrary user ids. The app does not insert memberships directly.
-- ---------------------------------------------------------------------------
drop policy if exists "Owners add members to their organisation" on public.provider_memberships;
revoke insert on public.provider_memberships from authenticated;

-- ---------------------------------------------------------------------------
-- 6. Geography: international readiness and idempotent root seed.
-- ---------------------------------------------------------------------------
alter table public.location_nodes drop constraint if exists location_nodes_country_code_check;
alter table public.location_nodes add constraint location_nodes_country_code_check check (country_code ~ '^[A-Z]{2}$');

do $$
begin
  if exists (select slug from public.location_nodes where parent_id is null group by slug having count(*) > 1) then
    raise exception 'Duplicate root locations exist. Resolve them (see preflight check 3) before applying this migration.';
  end if;
end $$;
-- unique (parent_id, slug) treats NULL parents as distinct, so re-running the 001 seed could duplicate "Nigeria".
create unique index if not exists location_nodes_root_slug_uidx on public.location_nodes(slug) where parent_id is null;

-- ---------------------------------------------------------------------------
-- 7. Audit trail: make "append-only" true at the database level.
-- ---------------------------------------------------------------------------
alter table public.admin_audit_logs
  add column if not exists actor_type text not null default 'user' check (actor_type in ('user','system','webhook','job')),
  add column if not exists actor_snapshot jsonb not null default '{}'::jsonb;
alter table public.admin_audit_logs alter column actor_id drop not null;
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_actor_id_fkey;
alter table public.admin_audit_logs add constraint admin_audit_logs_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
comment on column public.admin_audit_logs.actor_snapshot is 'Name/email/role captured at write time so the record stays meaningful if the account is later erased.';

create or replace function public.audit_log_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    -- the only permitted change: ON DELETE SET NULL when an account is erased
    if new.actor_id is null and old.actor_id is not null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
      return new;
    end if;
  end if;
  raise exception 'admin_audit_logs is append-only';
end;
$$;
drop trigger if exists admin_audit_logs_no_update on public.admin_audit_logs;
create trigger admin_audit_logs_no_update before update or delete on public.admin_audit_logs
for each row execute function public.audit_log_append_only();
drop trigger if exists admin_audit_logs_no_truncate on public.admin_audit_logs;
create trigger admin_audit_logs_no_truncate before truncate on public.admin_audit_logs
for each statement execute function public.audit_log_append_only();
revoke update, delete, truncate on public.admin_audit_logs from anon, authenticated, service_role;

-- Generic row-change recorder for money, plan and trust tables (attached in later migrations).
-- Payment rows hold no card data in this schema, so before/after snapshots are safe to log.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  row_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  row_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
begin
  insert into public.admin_audit_logs(actor_id, actor_type, action, target_type, target_id, before_state, after_state)
  values (auth.uid(), case when auth.uid() is null then 'system' else 'user' end,
          tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce(row_new ->> 'id', row_old ->> 'id'), row_old, row_new);
  return coalesce(new, old);
end;
$$;
revoke all on function public.audit_row_change() from public;

-- Generic immutability guard (used by payment_events and other ledgers).
create or replace function public.prevent_row_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

-- Membership changes are access-control changes and are now audited.
drop trigger if exists provider_memberships_audit on public.provider_memberships;
create trigger provider_memberships_audit after insert or delete on public.provider_memberships
for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 8. updated_at maintenance for tables that carried the column but never refreshed it.
-- ---------------------------------------------------------------------------
drop trigger if exists provider_organisations_touch on public.provider_organisations;
create trigger provider_organisations_touch before update on public.provider_organisations for each row execute function public.set_updated_at();
drop trigger if exists room_categories_touch on public.property_room_categories;
create trigger room_categories_touch before update on public.property_room_categories for each row execute function public.set_updated_at();
drop trigger if exists apartment_units_touch on public.property_apartment_units;
create trigger apartment_units_touch before update on public.property_apartment_units for each row execute function public.set_updated_at();
drop trigger if exists destination_profiles_touch on public.destination_profiles;
create trigger destination_profiles_touch before update on public.destination_profiles for each row execute function public.set_updated_at();
drop trigger if exists destination_content_touch on public.destination_content_items;
create trigger destination_content_touch before update on public.destination_content_items for each row execute function public.set_updated_at();
drop trigger if exists location_nodes_touch on public.location_nodes;
create trigger location_nodes_touch before update on public.location_nodes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Missing indexes on foreign keys (full scans on parent update/delete and on joins).
-- ---------------------------------------------------------------------------
create index if not exists provider_organisations_owner_idx on public.provider_organisations(owner_user_id);
create index if not exists provider_organisations_updated_by_idx on public.provider_organisations(updated_by) where updated_by is not null;
create index if not exists provider_organisations_suspended_by_idx on public.provider_organisations(suspended_by) where suspended_by is not null;
create index if not exists profiles_suspended_by_idx on public.profiles(suspended_by) where suspended_by is not null;
create index if not exists provider_invitations_invited_by_idx on public.provider_invitations(invited_by);
create index if not exists destination_profiles_reviewed_by_idx on public.destination_profiles(reviewed_by) where reviewed_by is not null;
create index if not exists destination_content_reviewed_by_idx on public.destination_content_items(reviewed_by) where reviewed_by is not null;
create index if not exists properties_moderated_by_idx on public.properties(moderated_by) where moderated_by is not null;
create index if not exists properties_verification_reviewed_by_idx on public.properties(verification_reviewed_by) where verification_reviewed_by is not null;
create index if not exists platform_permission_grants_granted_by_idx on public.platform_permission_grants(granted_by);
create index if not exists ai_listing_sessions_property_idx on public.ai_listing_sessions(property_id) where property_id is not null;
create index if not exists ai_listing_events_session_idx on public.ai_listing_events(session_id, created_at);
create index if not exists ai_listing_events_actor_idx on public.ai_listing_events(actor_id);
create index if not exists property_listing_reports_property_idx on public.property_listing_reports(property_id, status, created_at desc);
