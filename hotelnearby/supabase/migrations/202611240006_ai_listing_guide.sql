-- Prompt 11: auditable, provider-scoped AI listing assistance.
-- Apply after migrations 202611240001 through 202611240005.
-- No AI-generated property content is published or automatically applied.

create table if not exists public.ai_listing_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.provider_organisations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress','provider_reviewed','draft_created','abandoned')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  suggestions jsonb not null default '{}'::jsonb check (jsonb_typeof(suggestions) = 'object'),
  turn_count integer not null default 0 check (turn_count between 0 and 12),
  provider_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_listing_sessions_org_idx on public.ai_listing_sessions(organisation_id, created_at desc);
create index if not exists ai_listing_sessions_creator_idx on public.ai_listing_sessions(created_by, updated_at desc);

create table if not exists public.ai_listing_usage (
  organisation_id uuid not null references public.provider_organisations(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  request_count integer not null default 0 check (request_count between 0 and 20),
  input_characters integer not null default 0,
  output_tokens integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organisation_id, usage_date)
);

create table if not exists public.ai_listing_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_listing_sessions(id) on delete cascade,
  organisation_id uuid not null references public.provider_organisations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('session_started','guidance_generated','suggestion_accepted','provider_reviewed','draft_created','generation_failed')),
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_listing_events_org_idx on public.ai_listing_events(organisation_id, created_at desc);

alter table public.ai_listing_sessions enable row level security;
alter table public.ai_listing_usage enable row level security;
alter table public.ai_listing_events enable row level security;
revoke all on public.ai_listing_sessions, public.ai_listing_usage, public.ai_listing_events from anon;
grant select, insert, update on public.ai_listing_sessions to authenticated;
grant select on public.ai_listing_usage, public.ai_listing_events to authenticated;

create policy "Provider members manage their AI listing sessions"
on public.ai_listing_sessions for all to authenticated
using (public.is_provider_member(organisation_id) and created_by = auth.uid())
with check (public.is_provider_member(organisation_id) and created_by = auth.uid());
create policy "Provider members read their organisation AI usage"
on public.ai_listing_usage for select to authenticated
using (public.is_provider_member(organisation_id));
create policy "Provider members read their organisation AI events"
on public.ai_listing_events for select to authenticated
using (public.is_provider_member(organisation_id));

-- Atomic daily budget: maximum 20 generations per organisation per UTC day.
-- Called only after the server has independently checked provider membership.
create or replace function public.consume_ai_listing_quota(p_organisation_id uuid, p_input_characters integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_count integer;
begin
  if auth.uid() is null or not public.is_provider_member(p_organisation_id) then
    raise exception 'Provider membership required';
  end if;
  if p_input_characters < 0 or p_input_characters > 12000 then
    raise exception 'Input exceeds the allowed size';
  end if;
  insert into public.ai_listing_usage(organisation_id, usage_date, request_count, input_characters)
  values(p_organisation_id, (now() at time zone 'utc')::date, 1, p_input_characters)
  on conflict (organisation_id, usage_date) do update
    set request_count = public.ai_listing_usage.request_count + 1,
        input_characters = public.ai_listing_usage.input_characters + excluded.input_characters,
        updated_at = now()
    where public.ai_listing_usage.request_count < 20
  returning request_count into current_count;
  return current_count is not null;
end;
$$;
revoke all on function public.consume_ai_listing_quota(uuid, integer) from public;
grant execute on function public.consume_ai_listing_quota(uuid, integer) to authenticated;

create or replace function public.record_ai_listing_output(p_organisation_id uuid, p_output_tokens integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_provider_member(p_organisation_id) then
    raise exception 'Provider membership required';
  end if;
  update public.ai_listing_usage
  set output_tokens = output_tokens + greatest(0, least(p_output_tokens, 2000)), updated_at = now()
  where organisation_id = p_organisation_id and usage_date = (now() at time zone 'utc')::date;
end;
$$;
revoke all on function public.record_ai_listing_output(uuid, integer) from public;
grant execute on function public.record_ai_listing_output(uuid, integer) to authenticated;

create trigger ai_listing_sessions_touch_updated_at before update on public.ai_listing_sessions
for each row execute function public.touch_profile_updated_at();
grant insert on public.ai_listing_events to authenticated;
create policy "Provider members record their own AI listing events"
on public.ai_listing_events for insert to authenticated
with check (
  actor_id = auth.uid()
  and public.is_provider_member(organisation_id)
  and exists (
    select 1 from public.ai_listing_sessions s
    where s.id = session_id and s.organisation_id = ai_listing_events.organisation_id
      and s.created_by = auth.uid()
  )
);
