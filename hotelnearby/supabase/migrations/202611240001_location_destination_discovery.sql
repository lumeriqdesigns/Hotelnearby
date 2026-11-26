-- Prompt 6: geographic hierarchy and destination publication governance.
-- No neighbourhoods, landmarks, property counts or local businesses are seeded as facts.

create type public.location_level as enum (
  'country', 'state', 'city_town', 'neighbourhood', 'landmark'
);

create table public.location_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.location_nodes(id) on delete restrict,
  level public.location_level not null,
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  country_code char(2) not null default 'NG' check (country_code = 'NG'),
  region text,
  administrative_capital text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, slug),
  check (
    (level = 'country' and parent_id is null) or
    (level <> 'country' and parent_id is not null)
  )
);

create index location_nodes_parent_idx on public.location_nodes(parent_id, level, name);
create index location_nodes_slug_idx on public.location_nodes(slug);

create or replace function public.validate_location_parent()
returns trigger language plpgsql set search_path = public as $$
declare parent_level public.location_level;
begin
  if new.level = 'country' then
    if new.parent_id is not null then raise exception 'Country locations cannot have a parent'; end if;
    return new;
  end if;
  select level into parent_level from public.location_nodes where id = new.parent_id;
  if parent_level is null then raise exception 'A valid parent location is required'; end if;
  if (new.level = 'state' and parent_level <> 'country') or
     (new.level = 'city_town' and parent_level <> 'state') or
     (new.level = 'neighbourhood' and parent_level <> 'city_town') or
     (new.level = 'landmark' and parent_level not in ('city_town', 'neighbourhood')) then
    raise exception 'Invalid geographic parent for location level %', new.level;
  end if;
  return new;
end;
$$;
create trigger location_parent_guard before insert or update of parent_id, level
on public.location_nodes for each row execute function public.validate_location_parent();

create table public.destination_profiles (
  location_id uuid primary key references public.location_nodes(id) on delete cascade,
  editorial_summary text not null default '',
  visitor_information jsonb not null default '{}'::jsonb,
  transport_information jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  canonical_path text not null,
  manually_selected boolean not null default false,
  display_order integer not null default 0,
  publication_status text not null default 'upcoming' check (publication_status in ('upcoming', 'in_review', 'published', 'unpublished')),
  published_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (canonical_path like '/destinations/%'),
  check (publication_status <> 'published' or (published_at is not null and reviewed_at is not null and reviewed_by is not null))
);

-- Aggregated signals are maintained by trusted server jobs/triggers as property, content and analytics modules arrive.
-- They are not editable by providers and never displayed as estimates.
create table public.destination_quality_metrics (
  location_id uuid primary key references public.location_nodes(id) on delete cascade,
  approved_property_count integer not null default 0 check (approved_property_count >= 0),
  reviewed_local_content_count integer not null default 0 check (reviewed_local_content_count >= 0),
  listing_growth_30d integer not null default 0,
  search_demand_30d bigint not null default 0,
  property_views_30d bigint not null default 0,
  engagement_30d bigint not null default 0,
  contact_activity_30d bigint not null default 0,
  metrics_updated_at timestamptz,
  check (listing_growth_30d >= 0 and search_demand_30d >= 0 and property_views_30d >= 0 and engagement_30d >= 0 and contact_activity_30d >= 0)
);

create type public.destination_content_type as enum (
  'attraction', 'local_business', 'event', 'transport', 'guide', 'visitor_information'
);

create table public.destination_content_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location_nodes(id) on delete cascade,
  content_type public.destination_content_type not null,
  title text not null check (length(trim(title)) between 3 and 160),
  summary text not null check (length(trim(summary)) between 40 and 1200),
  details jsonb not null default '{}'::jsonb,
  source_reference text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'disputed')),
  publication_status text not null default 'draft' check (publication_status in ('draft', 'in_review', 'published', 'unpublished')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (publication_status <> 'published' or (verification_status = 'verified' and reviewed_by is not null and reviewed_at is not null and published_at is not null and source_reference is not null and length(trim(source_reference)) > 0))
);
create index destination_content_location_type_idx on public.destination_content_items(location_id, content_type, publication_status);

create or replace function public.require_city_town_destination()
returns trigger language plpgsql set search_path = public as $$
declare location_kind public.location_level;
begin
  select level into location_kind from public.location_nodes where id = new.location_id;
  if location_kind <> 'city_town' or location_kind is null then
    raise exception 'Destination profiles and destination content must belong to a city or town';
  end if;
  return new;
end;
$$;
create trigger destination_profile_city_guard before insert or update of location_id
on public.destination_profiles for each row execute function public.require_city_town_destination();
create trigger destination_content_city_guard before insert or update of location_id
on public.destination_content_items for each row execute function public.require_city_town_destination();

create or replace function public.refresh_destination_content_count(target_location_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare reviewed_count integer;
begin
  select count(*)::integer into reviewed_count
  from public.destination_content_items
  where location_id = target_location_id
    and publication_status = 'published'
    and verification_status = 'verified';
  insert into public.destination_quality_metrics (location_id, reviewed_local_content_count)
  values (target_location_id, reviewed_count)
  on conflict (location_id) do update set reviewed_local_content_count = excluded.reviewed_local_content_count;
end;
$$;

revoke all on function public.refresh_destination_content_count(uuid) from public, anon, authenticated;
grant execute on function public.refresh_destination_content_count(uuid) to service_role;

create or replace function public.destination_content_metrics_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_destination_content_count(old.location_id);
    return old;
  end if;
  perform public.refresh_destination_content_count(new.location_id);
  if tg_op = 'UPDATE' and old.location_id <> new.location_id then
    perform public.refresh_destination_content_count(old.location_id);
  end if;
  return new;
end;
$$;
create trigger destination_content_metrics_after_change
after insert or update or delete on public.destination_content_items
for each row execute function public.destination_content_metrics_trigger();

create table public.destination_publication_rules (
  id boolean primary key default true check (id),
  minimum_approved_properties integer not null default 3 check (minimum_approved_properties >= 1),
  minimum_reviewed_local_content integer not null default 2 check (minimum_reviewed_local_content >= 1),
  minimum_summary_characters integer not null default 160 check (minimum_summary_characters >= 80),
  updated_at timestamptz not null default now()
);
insert into public.destination_publication_rules (id) values (true) on conflict (id) do nothing;

create or replace function public.destination_meets_publication_threshold(target_location_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.destination_profiles d
    join public.destination_quality_metrics m on m.location_id = d.location_id
    cross join public.destination_publication_rules r
    where d.location_id = target_location_id
      and m.approved_property_count >= r.minimum_approved_properties
      and m.reviewed_local_content_count >= r.minimum_reviewed_local_content
      and char_length(trim(d.editorial_summary)) >= r.minimum_summary_characters
  );
$$;

create or replace function public.unpublish_destination_below_quality_threshold()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.destination_meets_publication_threshold(new.location_id) then
    update public.destination_profiles
    set publication_status = 'unpublished', published_at = null, updated_at = now()
    where location_id = new.location_id and publication_status = 'published';
  end if;
  return new;
end;
$$;
create trigger destination_metrics_publication_guard
after update of approved_property_count, reviewed_local_content_count on public.destination_quality_metrics
for each row execute function public.unpublish_destination_below_quality_threshold();

create or replace function public.guard_destination_publication()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.publication_status = 'published' and not public.destination_meets_publication_threshold(new.location_id) then
    raise exception 'Destination does not meet the configured publication quality threshold';
  end if;
  return new;
end;
$$;
create trigger destination_publication_guard before insert or update of publication_status, editorial_summary
on public.destination_profiles for each row execute function public.guard_destination_publication();

-- RLS: public can only read published destination profiles and active location ancestry.
-- Admin is determined by a trusted app_metadata claim, never user-editable user_metadata.
alter table public.location_nodes enable row level security;
alter table public.destination_profiles enable row level security;
alter table public.destination_quality_metrics enable row level security;
alter table public.destination_publication_rules enable row level security;
alter table public.destination_content_items enable row level security;

grant select on public.location_nodes, public.destination_profiles to anon, authenticated;
grant select on public.destination_quality_metrics to authenticated;
grant select, insert, update, delete on public.location_nodes, public.destination_profiles, public.destination_publication_rules, public.destination_content_items to authenticated;
grant select on public.destination_content_items to anon;
grant all on public.location_nodes, public.destination_profiles, public.destination_quality_metrics, public.destination_publication_rules, public.destination_content_items to service_role;

create or replace function public.is_within_published_destination(target_location_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive ancestry as (
    select id, parent_id, level from public.location_nodes where id = target_location_id
    union all
    select parent.id, parent.parent_id, parent.level
    from public.location_nodes parent join ancestry child on parent.id = child.parent_id
  )
  select exists (
    select 1 from ancestry a join public.destination_profiles dp on dp.location_id = a.id
    where a.level = 'city_town' and dp.publication_status = 'published'
  );
$$;

create policy "Public reads active location hierarchy" on public.location_nodes
for select to anon, authenticated using (is_active and (
  level in ('country', 'state') or exists (
    select 1 from public.destination_profiles dp
    where dp.location_id = location_nodes.id and dp.publication_status = 'published'
  ) or public.is_within_published_destination(id)
));
create policy "Admins manage location hierarchy" on public.location_nodes
for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public reads published destination profiles" on public.destination_profiles
for select to anon, authenticated using (publication_status = 'published');
create policy "Admins manage destination profiles" on public.destination_profiles
for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public reads verified published destination content" on public.destination_content_items
for select to anon, authenticated using (publication_status = 'published' and verification_status = 'verified');
create policy "Admins manage destination content" on public.destination_content_items
for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins read destination quality metrics" on public.destination_quality_metrics
for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins manage publication rules" on public.destination_publication_rules
for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Transparent initial recommendation ranking: equal-weight percentile ranks across all six signals.
-- It is advisory only. Homepage placement still requires an administrator to set manually_selected=true.
create or replace view public.destination_recommendations with (security_invoker = true) as
with ranked as (
  select
    l.id as location_id, l.name, l.slug,
    m.approved_property_count, m.listing_growth_30d, m.search_demand_30d,
    m.property_views_30d, m.engagement_30d, m.contact_activity_30d,
    (percent_rank() over (order by m.approved_property_count) +
     percent_rank() over (order by m.listing_growth_30d) +
     percent_rank() over (order by m.search_demand_30d) +
     percent_rank() over (order by m.property_views_30d) +
     percent_rank() over (order by m.engagement_30d) +
     percent_rank() over (order by m.contact_activity_30d)) / 6.0 as recommendation_score
  from public.location_nodes l
  join public.destination_quality_metrics m on m.location_id = l.id
  where l.level = 'city_town'
    and (m.approved_property_count + m.listing_growth_30d + m.search_demand_30d + m.property_views_30d + m.engagement_30d + m.contact_activity_30d) > 0
)
select * from ranked order by recommendation_score desc;
grant select on public.destination_recommendations to authenticated;

-- Public pages may display approved counts, but not private search/view/engagement signals.
create or replace view public.published_destination_property_counts with (security_barrier = true) as
select m.location_id, m.approved_property_count
from public.destination_quality_metrics m
join public.destination_profiles dp on dp.location_id = m.location_id
where dp.publication_status = 'published';
grant select on public.published_destination_property_counts to anon, authenticated;

-- Narrow public projection: exposes only admin-selected homepage card fields, never draft editorial content.
-- The view owner can read the underlying tables; the exposed columns are intentionally limited.
create or replace view public.homepage_destination_cards with (security_barrier = true) as
select l.id, l.name, l.slug, state.name as state_name, state.slug as state_slug, dp.publication_status, dp.display_order,
       coalesce(m.approved_property_count, 0) as approved_property_count
from public.location_nodes l
join public.location_nodes state on state.id = l.parent_id and state.level = 'state'
join public.destination_profiles dp on dp.location_id = l.id
left join public.destination_quality_metrics m on m.location_id = l.id
where l.level = 'city_town' and l.is_active = true and dp.manually_selected = true
order by dp.display_order asc, l.name asc;
grant select on public.homepage_destination_cards to anon, authenticated;

-- Safe route projection lets an admin-selected upcoming city show an honest placeholder page.
-- Draft editorial text, private metrics and unpublished content are not exposed by this view.
create or replace view public.public_destination_routes with (security_barrier = true) as
select l.id, l.name, l.slug, state.name as state_name, state.slug as state_slug,
       dp.publication_status, coalesce(m.approved_property_count, 0) as approved_property_count
from public.location_nodes l
join public.location_nodes state on state.id = l.parent_id and state.level = 'state'
join public.destination_profiles dp on dp.location_id = l.id
left join public.destination_quality_metrics m on m.location_id = l.id
where l.level = 'city_town' and l.is_active = true
  and (dp.publication_status = 'published' or dp.manually_selected = true);
grant select on public.public_destination_routes to anon, authenticated;

-- Seed Nigeria, all 36 states + FCT, and the requested Kwara launch towns.
insert into public.location_nodes (level, name, slug, country_code)
values ('country', 'Nigeria', 'nigeria', 'NG') on conflict (parent_id, slug) do nothing;

with states(name, slug, capital, region) as (values
  ('Abia','abia','Umuahia','South East'),('Adamawa','adamawa','Yola','North East'),
  ('Akwa Ibom','akwa-ibom','Uyo','South South'),('Anambra','anambra','Awka','South East'),
  ('Bauchi','bauchi','Bauchi','North East'),('Bayelsa','bayelsa','Yenagoa','South South'),
  ('Benue','benue','Makurdi','North Central'),('Borno','borno','Maiduguri','North East'),
  ('Cross River','cross-river','Calabar','South South'),('Delta','delta','Asaba','South South'),
  ('Ebonyi','ebonyi','Abakaliki','South East'),('Edo','edo','Benin City','South South'),
  ('Ekiti','ekiti','Ado-Ekiti','South West'),('Enugu','enugu','Enugu','South East'),
  ('Gombe','gombe','Gombe','North East'),('Imo','imo','Owerri','South East'),
  ('Jigawa','jigawa','Dutse','North West'),('Kaduna','kaduna','Kaduna','North West'),
  ('Kano','kano','Kano','North West'),('Katsina','katsina','Katsina','North West'),
  ('Kebbi','kebbi','Birnin Kebbi','North West'),('Kogi','kogi','Lokoja','North Central'),
  ('Kwara','kwara','Ilorin','North Central'),('Lagos','lagos','Ikeja','South West'),
  ('Nasarawa','nasarawa','Lafia','North Central'),('Niger','niger','Minna','North Central'),
  ('Ogun','ogun','Abeokuta','South West'),('Ondo','ondo','Akure','South West'),
  ('Osun','osun','Osogbo','South West'),('Oyo','oyo','Ibadan','South West'),
  ('Plateau','plateau','Jos','North Central'),('Rivers','rivers','Port Harcourt','South South'),
  ('Sokoto','sokoto','Sokoto','North West'),('Taraba','taraba','Jalingo','North East'),
  ('Yobe','yobe','Damaturu','North East'),('Zamfara','zamfara','Gusau','North West'),
  ('Federal Capital Territory','fct','Abuja','North Central')
)
insert into public.location_nodes (parent_id, level, name, slug, country_code, region, administrative_capital)
select c.id, 'state', s.name, s.slug, 'NG', s.region, s.capital
from states s cross join public.location_nodes c
where c.level = 'country' and c.slug = 'nigeria'
on conflict (parent_id, slug) do update set region = excluded.region, administrative_capital = excluded.administrative_capital;

with towns(name, slug) as (values
  ('Ilorin','ilorin'),('Offa','offa'),('Omu-Aran','omu-aran'),('Jebba','jebba'),
  ('Lafiagi','lafiagi'),('Patigi','patigi'),('Kaiama','kaiama'),('Osi','osi'),('Igbaja','igbaja'),('Share','share')
)
insert into public.location_nodes (parent_id, level, name, slug, country_code)
select s.id, 'city_town', t.name, t.slug, 'NG'
from towns t cross join public.location_nodes s
where s.level = 'state' and s.slug = 'kwara'
on conflict (parent_id, slug) do nothing;

insert into public.destination_profiles (location_id, canonical_path, publication_status)
select id, '/destinations/' || slug, 'upcoming'
from public.location_nodes where level = 'city_town' and parent_id = (select id from public.location_nodes where level = 'state' and slug = 'kwara')
on conflict (location_id) do nothing;

insert into public.destination_quality_metrics (location_id)
select id from public.location_nodes where level = 'city_town'
on conflict (location_id) do nothing;

comment on table public.location_nodes is 'Nigeria-first country/state/city/neighbourhood/landmark hierarchy. Add neighbourhoods and landmarks only after verification.';
comment on table public.destination_profiles is 'Editorial and admin-controlled destination publication state; upcoming pages are noindex until eligible.';
comment on table public.destination_quality_metrics is 'Trusted aggregate signals used for recommendations and destination publication gating.';
comment on table public.destination_content_items is 'Fact-checked local destination information. Public pages show only verified, published items.';
