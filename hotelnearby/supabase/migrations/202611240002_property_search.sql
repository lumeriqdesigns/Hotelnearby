-- Prompt 7: approved-property search foundation.
create extension if not exists pg_trgm;
-- This creates real property records and a narrow public search projection.
-- No property rows are seeded; providers/admins will create and approve real records.

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid,
  location_id uuid not null references public.location_nodes(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (category in (
    'hotel', 'serviced-apartment', 'shortlet', 'guest-house', 'lodge',
    'resort', 'boutique-stay', 'hostel', 'villa', 'holiday-home'
  )),
  description text not null default '',
  price_amount numeric(14,2) check (price_amount is null or price_amount >= 0),
  price_basis text check (price_basis is null or price_basis in ('night', 'day', 'week', 'month', 'stay', 'other')),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(4,1) check (bathrooms is null or bathrooms >= 0),
  guest_capacity integer check (guest_capacity is null or guest_capacity >= 1),
  amenities text[] not null default '{}',
  features text[] not null default '{}',
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  search_document tsvector generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))) stored,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_public_status_idx on public.properties (approval_status, is_active, created_at desc);
create index properties_location_idx on public.properties (location_id);
create index properties_category_idx on public.properties (category);
create index properties_verification_idx on public.properties (verification_status);
create index properties_price_idx on public.properties (price_amount) where price_amount is not null;
create index properties_capacity_idx on public.properties (bedrooms, bathrooms, guest_capacity);
create index properties_amenities_gin_idx on public.properties using gin (amenities);
create index properties_features_gin_idx on public.properties using gin (features);
create index properties_search_text_idx on public.properties using gin (search_document);
create index properties_name_trgm_idx on public.properties using gin (name gin_trgm_ops);
create index properties_description_trgm_idx on public.properties using gin (description gin_trgm_ops);
create index location_nodes_name_trgm_idx on public.location_nodes using gin (name gin_trgm_ops);

alter table public.properties enable row level security;
grant select on public.properties to anon, authenticated;
grant all on public.properties to service_role;
create or replace function public.touch_property_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger properties_touch_updated_at before update on public.properties
for each row execute function public.touch_property_updated_at();
create policy "Public reads approved active properties" on public.properties
  for select to anon, authenticated using (approval_status = 'approved' and is_active = true);

-- A safe, read-only projection containing only fields required for public discovery.
-- The view owner can traverse the full location hierarchy, including upcoming towns,
-- without exposing unpublished destination editorial content or private metrics.
create or replace view public.public_property_search with (security_barrier = true) as
with recursive ancestry as (
  select p.id as property_id, l.id as node_id, l.parent_id, l.level, l.name
  from public.properties p
  join public.location_nodes l on l.id = p.location_id
  where p.approval_status = 'approved' and p.is_active = true
  union all
  select a.property_id, parent.id, parent.parent_id, parent.level, parent.name
  from ancestry a
  join public.location_nodes parent on parent.id = a.parent_id
)
select
  p.id, p.name, p.slug, p.category, p.description, p.price_amount, p.price_basis,
  p.bedrooms, p.bathrooms, p.guest_capacity, p.amenities, p.features,
  p.cover_image_url, p.verification_status, p.created_at, p.updated_at, p.search_document,
  max(a.name) filter (where a.level = 'state') as state_name,
  max(a.name) filter (where a.level = 'city_town') as city_name,
  max(a.name) filter (where a.level = 'neighbourhood') as neighbourhood_name,
  max(a.name) filter (where a.level = 'landmark') as landmark_name
from public.properties p
join ancestry a on a.property_id = p.id
group by p.id;

grant select on public.public_property_search to anon, authenticated;

create or replace function public.search_public_properties(
  p_query text default null,
  p_category text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms integer default null,
  p_bathrooms numeric default null,
  p_guest_capacity integer default null,
  p_amenities text[] default null,
  p_features text[] default null,
  p_verification text default null,
  p_sort text default 'relevance',
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid, name text, slug text, category text, description text,
  price_amount numeric, price_basis text, bedrooms integer, bathrooms numeric,
  guest_capacity integer, amenities text[], features text[], cover_image_url text,
  verification_status text, created_at timestamptz, updated_at timestamptz,
  state_name text, city_name text, neighbourhood_name text, landmark_name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select v.*,
      case when nullif(trim(p_query), '') is null then 0::real
      else ts_rank(to_tsvector('simple', concat_ws(' ', v.name, v.description, v.category, v.state_name, v.city_name, v.neighbourhood_name, v.landmark_name)), websearch_to_tsquery('simple', p_query)) end as relevance_rank
    from public.public_property_search v
    where (nullif(trim(p_query), '') is null or
      v.name ilike '%' || trim(p_query) || '%' or
      v.description ilike '%' || trim(p_query) || '%' or
      v.category ilike '%' || trim(p_query) || '%' or
      coalesce(v.state_name, '') ilike '%' || trim(p_query) || '%' or
      coalesce(v.city_name, '') ilike '%' || trim(p_query) || '%' or
      coalesce(v.neighbourhood_name, '') ilike '%' || trim(p_query) || '%' or
      coalesce(v.landmark_name, '') ilike '%' || trim(p_query) || '%' or
      v.search_document @@ websearch_to_tsquery('simple', p_query) or
      to_tsvector('simple', concat_ws(' ', v.name, v.description, v.category, v.state_name, v.city_name, v.neighbourhood_name, v.landmark_name)) @@ websearch_to_tsquery('simple', p_query))
      and (p_category is null or v.category = p_category)
      and (p_min_price is null or v.price_amount >= p_min_price)
      and (p_max_price is null or v.price_amount <= p_max_price)
      and (p_bedrooms is null or v.bedrooms >= p_bedrooms)
      and (p_bathrooms is null or v.bathrooms >= p_bathrooms)
      and (p_guest_capacity is null or v.guest_capacity >= p_guest_capacity)
      and (p_amenities is null or v.amenities @> p_amenities)
      and (p_features is null or v.features && p_features)
      and (p_verification is null or (p_verification = 'unverified' and v.verification_status <> 'verified') or v.verification_status = p_verification)
  ), counted as (
    select filtered.*, count(*) over() as total_count from filtered
  )
  select
    c.id, c.name, c.slug, c.category, c.description, c.price_amount, c.price_basis,
    c.bedrooms, c.bathrooms, c.guest_capacity, c.amenities, c.features,
    c.cover_image_url, c.verification_status, c.created_at, c.updated_at,
    c.state_name, c.city_name, c.neighbourhood_name, c.landmark_name, c.total_count
  from counted c
  order by
    case when p_sort = 'relevance' then c.relevance_rank end desc,
    case when p_sort = 'lowest-price' then c.price_amount end asc nulls last,
    case when p_sort = 'highest-price' then c.price_amount end desc nulls last,
    case when p_sort = 'recently-updated' then extract(epoch from c.updated_at) end desc,
    case when p_sort = 'newest' then extract(epoch from c.created_at) end desc,
    c.updated_at desc
  limit least(greatest(coalesce(p_page_size, 12), 1), 48)
  offset ((greatest(coalesce(p_page, 1), 1)::bigint - 1) * least(greatest(coalesce(p_page_size, 12), 1), 48)::bigint);
$$;

revoke all on function public.search_public_properties(text,text,numeric,numeric,integer,numeric,integer,text[],text[],text,text,integer,integer) from public;
grant execute on function public.search_public_properties(text,text,numeric,numeric,integer,numeric,integer,text[],text[],text,text,integer,integer) to anon, authenticated;

comment on table public.properties is 'Real accommodation property records. Public search includes only approved active properties.';
comment on function public.search_public_properties is 'Combined, paginated public property search. Does not model reservations or guest bookings.';
