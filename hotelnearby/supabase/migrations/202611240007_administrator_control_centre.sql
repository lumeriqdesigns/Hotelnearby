-- Prompt 12: administrator control centre, account controls and immutable audit trail.
-- Apply after migrations 001-006. No admin users or business records are seeded.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id),
  add column if not exists suspension_reason text;

alter table public.provider_organisations
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id),
  add column if not exists suspension_reason text;

alter table public.properties
  add column if not exists moderation_note text,
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderated_at timestamptz,
  add column if not exists verification_note text,
  add column if not exists verification_reviewed_by uuid references auth.users(id),
  add column if not exists verification_reviewed_at timestamptz;

alter table public.properties drop constraint if exists properties_approval_status_check;
alter table public.properties add constraint properties_approval_status_check
  check (approval_status in ('draft','pending_review','approved','rejected','correction_requested','suspended'));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (length(action) between 2 and 100),
  target_type text not null check (length(target_type) between 2 and 80),
  target_id text,
  reason text,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs(actor_id, created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs(target_type, target_id, created_at desc);
alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
create policy "Administrators read audit logs" on public.admin_audit_logs
  for select to authenticated using (public.has_any_platform_role(array['administrator']::public.platform_role[]));
create policy "Administrators append audit logs" on public.admin_audit_logs
  for insert to authenticated with check (actor_id = auth.uid() and public.has_any_platform_role(array['administrator']::public.platform_role[]));

-- Optional user-level grants are intentionally limited to non-admin staff roles.
create table if not exists public.platform_permission_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null check (permission_key in (
    'destinations.manage','content.manage','events.manage','support.manage','newsletter.manage','reports.view'
  )),
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(user_id, permission_key)
);
alter table public.platform_permission_grants enable row level security;
revoke all on public.platform_permission_grants from anon, authenticated;
grant select on public.platform_permission_grants to authenticated;
create policy "Administrators manage permission grants" on public.platform_permission_grants
  for all to authenticated using (public.has_any_platform_role(array['administrator']::public.platform_role[]))
  with check (public.has_any_platform_role(array['administrator']::public.platform_role[]));


create or replace function public.admin_set_permission_grant(p_user_id uuid, p_permission_key text, p_granted boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
declare target_role public.platform_role;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_permission_key not in ('destinations.manage','content.manage','events.manage','support.manage','newsletter.manage','reports.view') then raise exception 'Invalid permission'; end if;
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

-- Suspended users lose all application roles; suspended provider organisations lose membership access.
create or replace function public.current_platform_role()
returns public.platform_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and account_status = 'active' limit 1 $$;

create or replace function public.is_provider_member(p_organisation_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.provider_memberships m
    join public.provider_organisations o on o.id = m.organisation_id
    join public.profiles p on p.id = m.user_id
    where m.organisation_id = p_organisation_id and m.user_id = auth.uid()
      and o.account_status = 'active' and p.account_status = 'active'
  )
$$;

create or replace function public.is_provider_owner(p_organisation_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.provider_memberships m
    where m.organisation_id = p_organisation_id and m.user_id = auth.uid()
      and m.role = 'owner' and public.is_provider_member(p_organisation_id))
$$;

create or replace function public.set_platform_role(p_user_id uuid, p_role public.platform_role)
returns boolean language plpgsql security definer set search_path = public
as $$
declare old_role public.platform_role; old_status text;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_role not in ('visitor','administrator','editor_moderator') then raise exception 'This role must be assigned through provider registration or membership'; end if;
  select role,account_status into old_role,old_status from public.profiles where id=p_user_id for update;
  if old_role is null then return false; end if;
  if old_role='administrator' and p_role <> 'administrator' and old_status='active'
    and (select count(*) from public.profiles where role='administrator' and account_status='active') <= 1
  then raise exception 'The last active administrator cannot be demoted'; end if;
  if p_user_id=auth.uid() and p_role <> 'administrator' then raise exception 'You cannot change your own administrator role'; end if;
  update public.profiles set role=p_role,updated_at=now() where id=p_user_id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_state,after_state)
    values(auth.uid(),'user.role_changed','profile',p_user_id::text,jsonb_build_object('role',old_role),jsonb_build_object('role',p_role));
  return true;
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public
as $$
declare old_row public.profiles%rowtype;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid account status'; end if;
  if p_status='suspended' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A suspension reason is required'; end if;
  if p_user_id = auth.uid() and p_status = 'suspended' then raise exception 'You cannot suspend your own administrator account'; end if;
  select * into old_row from public.profiles where id = p_user_id for update;
  if old_row.id is null then return false; end if;
  if old_row.role = 'administrator' and p_status = 'suspended' and
     (select count(*) from public.profiles where role = 'administrator' and account_status = 'active') <= 1
  then raise exception 'The last active administrator cannot be suspended'; end if;
  update public.profiles set account_status = p_status,
    suspended_at = case when p_status = 'suspended' then now() else null end,
    suspended_by = case when p_status = 'suspended' then auth.uid() else null end,
    suspension_reason = case when p_status = 'suspended' then nullif(left(trim(coalesce(p_reason,'')),500),'') else null end,
    updated_at = now() where id = p_user_id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,reason,before_state,after_state)
  values(auth.uid(), case when p_status='suspended' then 'user.suspended' else 'user.reinstated' end,
    'profile',p_user_id::text,nullif(left(trim(coalesce(p_reason,'')),500),''),
    jsonb_build_object('account_status',old_row.account_status,'role',old_row.role),
    jsonb_build_object('account_status',p_status,'role',old_row.role));
  return true;
end;
$$;

create or replace function public.admin_set_organisation_status(p_organisation_id uuid, p_status text, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public
as $$
declare old_row public.provider_organisations%rowtype;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid organisation status'; end if;
  if p_status='suspended' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A suspension reason is required'; end if;
  select * into old_row from public.provider_organisations where id = p_organisation_id for update;
  if old_row.id is null then return false; end if;
  update public.provider_organisations set account_status = p_status,
    suspended_at = case when p_status='suspended' then now() else null end,
    suspended_by = case when p_status='suspended' then auth.uid() else null end,
    suspension_reason = case when p_status='suspended' then nullif(left(trim(coalesce(p_reason,'')),500),'') else null end,
    updated_at = now() where id = p_organisation_id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,reason,before_state,after_state)
  values(auth.uid(),case when p_status='suspended' then 'organisation.suspended' else 'organisation.reinstated' end,
    'provider_organisation',p_organisation_id::text,nullif(left(trim(coalesce(p_reason,'')),500),''),
    jsonb_build_object('account_status',old_row.account_status),jsonb_build_object('account_status',p_status));
  return true;
end;
$$;

create or replace function public.admin_moderate_property(p_property_id uuid, p_action text, p_note text default null)
returns boolean language plpgsql security definer set search_path = public
as $$
declare old_row public.properties%rowtype; new_status text;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_action not in ('approve','reject','request_corrections','suspend','reinstate') then raise exception 'Invalid moderation action'; end if;
  new_status := case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
    when 'request_corrections' then 'correction_requested' when 'suspend' then 'suspended' else 'approved' end;
  if p_action in ('reject','request_corrections','suspend') and nullif(trim(coalesce(p_note,'')),'') is null
    then raise exception 'A reason or correction note is required'; end if;
  select * into old_row from public.properties where id = p_property_id for update;
  if old_row.id is null then return false; end if;
  update public.properties set approval_status = new_status,
    is_active = case when p_action='suspend' then false when p_action='reinstate' then true else is_active end,
    moderation_note = nullif(left(trim(coalesce(p_note,'')),2000),''),
    moderated_by = auth.uid(), moderated_at = now(), updated_at = now()
  where id = p_property_id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,reason,before_state,after_state)
  values(auth.uid(),'property.'||p_action,'property',p_property_id::text,nullif(left(trim(coalesce(p_note,'')),500),''),
    jsonb_build_object('approval_status',old_row.approval_status,'verification_status',old_row.verification_status,'is_active',old_row.is_active),
    jsonb_build_object('approval_status',new_status,'verification_status',old_row.verification_status,'is_active',case when p_action='suspend' then false when p_action='reinstate' then true else old_row.is_active end));
  return true;
end;
$$;

create or replace function public.admin_set_verification(p_property_id uuid, p_status text, p_note text default null)
returns boolean language plpgsql security definer set search_path = public
as $$
declare old_row public.properties%rowtype;
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_status not in ('unverified','pending','verified','rejected') then raise exception 'Invalid verification status'; end if;
  if p_status in ('verified','rejected') and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'A verification decision note is required'; end if;
  select * into old_row from public.properties where id = p_property_id for update;
  if old_row.id is null then return false; end if;
  update public.properties set verification_status=p_status, verification_note=nullif(left(trim(coalesce(p_note,'')),2000),''), verification_reviewed_by=auth.uid(), verification_reviewed_at=now(), updated_at=now() where id=p_property_id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,reason,before_state,after_state)
  values(auth.uid(),'property.verification.'||p_status,'property',p_property_id::text,nullif(left(trim(coalesce(p_note,'')),500),''),
    jsonb_build_object('verification_status',old_row.verification_status),jsonb_build_object('verification_status',p_status,'verification_note',nullif(left(trim(coalesce(p_note,'')),500),'')));
  return true;
end;
$$;

-- Profile directory access is administrator-only; users and provider teammates retain their scoped reads.
drop policy if exists "Users read own profile or platform staff read all" on public.profiles;
create policy "Users read own profile or administrators read all" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_any_platform_role(array['administrator']::public.platform_role[]));

-- Only active administrators can administer the control centre. Moderators retain no /admin access.
drop policy if exists "Platform staff manage properties" on public.properties;
create policy "Administrators manage properties" on public.properties
  for all to authenticated using (public.has_any_platform_role(array['administrator']::public.platform_role[]))
  with check (public.has_any_platform_role(array['administrator']::public.platform_role[]));
create policy "Administrators read provider organisations" on public.provider_organisations
  for select to authenticated using (public.has_any_platform_role(array['administrator']::public.platform_role[]));

-- Destination administration is also restricted to active administrators.
drop policy if exists "Admins manage location hierarchy" on public.location_nodes;
create policy "Admins manage location hierarchy" on public.location_nodes for all to authenticated
  using (public.has_any_platform_role(array['administrator']::public.platform_role[]))
  with check (public.has_any_platform_role(array['administrator']::public.platform_role[]));
drop policy if exists "Admins manage destination profiles" on public.destination_profiles;
create policy "Admins manage destination profiles" on public.destination_profiles for all to authenticated
  using (public.has_any_platform_role(array['administrator']::public.platform_role[]))
  with check (public.has_any_platform_role(array['administrator']::public.platform_role[]));
drop policy if exists "Admins manage destination content" on public.destination_content_items;
create policy "Admins manage destination content" on public.destination_content_items for all to authenticated
  using (public.has_any_platform_role(array['administrator']::public.platform_role[]))
  with check (public.has_any_platform_role(array['administrator']::public.platform_role[]));
drop policy if exists "Admins read destination quality metrics" on public.destination_quality_metrics;
create policy "Admins read destination quality metrics" on public.destination_quality_metrics for select to authenticated
  using (public.has_any_platform_role(array['administrator']::public.platform_role[]));
drop policy if exists "Admins manage publication rules" on public.destination_publication_rules;
create policy "Admins manage publication rules" on public.destination_publication_rules for all to authenticated
  using (public.has_any_platform_role(array['administrator']::public.platform_role[]))
  with check (public.has_any_platform_role(array['administrator']::public.platform_role[]));

-- Provider submissions may be resubmitted after rejection or correction request, but may not alter admin fields.
create or replace function public.guard_provider_listing_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.current_platform_role() in ('provider_owner','provider_staff') then
    if tg_op = 'INSERT' then
      if new.approval_status <> 'draft' or new.verification_status <> 'unverified' then
        raise exception 'New provider listings must start as draft and unverified';
      end if;
    else
      if new.approval_status is distinct from old.approval_status
        and not (old.approval_status in ('draft','rejected','correction_requested') and new.approval_status = 'pending_review') then
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

revoke all on function public.admin_set_user_status(uuid,text,text) from public;
revoke all on function public.admin_set_organisation_status(uuid,text,text) from public;
revoke all on function public.admin_moderate_property(uuid,text,text) from public;
revoke all on function public.admin_set_verification(uuid,text,text) from public;
revoke all on function public.admin_set_permission_grant(uuid,text,boolean) from public;
grant execute on function public.admin_set_user_status(uuid,text,text) to authenticated;
grant execute on function public.admin_set_organisation_status(uuid,text,text) to authenticated;
grant execute on function public.admin_moderate_property(uuid,text,text) to authenticated;
grant execute on function public.admin_set_verification(uuid,text,text) to authenticated;
grant execute on function public.admin_set_permission_grant(uuid,text,boolean) to authenticated;
