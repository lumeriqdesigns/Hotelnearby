-- Human support intake. Anonymous submissions are accepted only through a
-- narrowly scoped SECURITY DEFINER RPC; direct table writes are not granted.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('visitor_support','provider_support','advertising','partnership','listing_report','technical','other')),
  requester_name text not null check (length(trim(requester_name)) between 2 and 100),
  requester_email text not null check (length(trim(requester_email)) between 5 and 180),
  requester_contact text,
  subject text not null check (length(trim(subject)) between 4 and 160),
  message text not null check (length(trim(message)) between 15 and 4000),
  status text not null default 'open' check (status in ('open','in_progress','awaiting_requester','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_requests_queue_idx on public.support_requests(status,created_at desc);
create index if not exists support_requests_email_idx on public.support_requests(lower(requester_email),created_at desc);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
create policy "Support staff can view requests" on public.support_requests for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrator')
  or public.has_staff_permission('support.manage')
);
create policy "Support staff can update requests" on public.support_requests for update to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrator')
  or public.has_staff_permission('support.manage')
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrator')
  or public.has_staff_permission('support.manage')
);

create table if not exists public.support_request_events (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.support_request_events enable row level security;
revoke all on public.support_request_events from anon, authenticated;
grant select on public.support_request_events to authenticated;
create policy "Support staff can view support history" on public.support_request_events for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrator')
  or public.has_staff_permission('support.manage')
);

create or replace function public.submit_public_support_request(
  p_kind text,p_name text,p_email text,p_contact text,p_subject text,p_message text
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_kind not in ('visitor_support','provider_support','advertising','partnership','listing_report','technical','other')
    or length(trim(coalesce(p_name,''))) not between 2 and 100
    or length(trim(coalesce(p_email,''))) not between 5 and 180
    or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or length(trim(coalesce(p_subject,''))) not between 4 and 160
    or length(trim(coalesce(p_message,''))) not between 15 and 4000
    or length(coalesce(p_contact,'')) > 40 then return false; end if;
  -- Basic abuse throttling: no more than five submissions from the same email in 15 minutes.
  if (select count(*) from public.support_requests where lower(requester_email)=lower(trim(p_email)) and created_at>now()-interval '15 minutes') >= 5 then return false; end if;
  insert into public.support_requests(requester_id,kind,requester_name,requester_email,requester_contact,subject,message)
  values(auth.uid(),p_kind,trim(p_name),lower(trim(p_email)),nullif(trim(coalesce(p_contact,'')),''),trim(p_subject),trim(p_message)) returning id into v_id;
  insert into public.support_request_events(support_request_id,actor_id,event_type,note) values(v_id,auth.uid(),'submitted','Public support form submission');
  return true;
end; $$;
revoke all on function public.submit_public_support_request(text,text,text,text,text,text) from public;
grant execute on function public.submit_public_support_request(text,text,text,text,text,text) to anon,authenticated;

create or replace function public.admin_update_support_request(p_id uuid,p_status text,p_note text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrator') or public.has_staff_permission('support.manage')) then raise exception 'Support management permission required'; end if;
  if p_status not in ('open','in_progress','awaiting_requester','resolved','closed') or length(trim(coalesce(p_note,'')))<5 or length(p_note)>2000 then raise exception 'A valid status and staff note are required'; end if;
  update public.support_requests set status=p_status,assigned_to=auth.uid(),staff_note=trim(p_note),updated_at=now() where id=p_id;
  if not found then return false; end if;
  insert into public.support_request_events(support_request_id,actor_id,event_type,note) values(p_id,auth.uid(),p_status,trim(p_note));
  return true;
end; $$;
revoke all on function public.admin_update_support_request(uuid,text,text) from public;
grant execute on function public.admin_update_support_request(uuid,text,text) to authenticated;
