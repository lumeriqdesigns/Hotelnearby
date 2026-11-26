-- Prompt 13 / migration 009: normalise listing data without removing any existing column.
-- STATUS: PROPOSED. Not applied anywhere. Requires 008.
-- Strategy ("expand, then contract"): new normalised tables are added and backfilled from the existing
-- text[] / contact columns. The existing columns stay the single WRITE path (the app writes them today);
-- triggers mirror them into the normalised tables. Dropping the old columns is a separate, later,
-- explicitly approved step (migration report, section 6).

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id and p.organisation_id is not null
      and public.is_provider_member(p.organisation_id)
  )
$$;
revoke all on function public.can_manage_property(uuid) from public;
grant execute on function public.can_manage_property(uuid) to authenticated, service_role;

create or replace function public.location_ancestor_id(p_location_id uuid, p_level public.location_level)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  with recursive up as (
    select id, parent_id, level from public.location_nodes where id = p_location_id
    union all
    select n.id, n.parent_id, n.level from public.location_nodes n join up on n.id = up.parent_id
  )
  select id from up where level = p_level limit 1
$$;
revoke all on function public.location_ancestor_id(uuid, public.location_level) from public;
grant execute on function public.location_ancestor_id(uuid, public.location_level) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Accommodation categories become data, not a CHECK list (admin "categories" module).
-- ---------------------------------------------------------------------------
create table if not exists public.accommodation_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.accommodation_categories (slug, name, display_order) values
  ('hotel','Hotel',10), ('serviced-apartment','Serviced apartment',20), ('shortlet','Shortlet',30),
  ('guest-house','Guest house',40), ('lodge','Lodge',50), ('resort','Resort',60),
  ('boutique-stay','Boutique stay',70), ('hostel','Hostel',80), ('villa','Villa',90),
  ('holiday-home','Holiday home',100)
on conflict (slug) do nothing;

alter table public.properties drop constraint if exists properties_category_fk;
alter table public.properties add constraint properties_category_fk
  foreign key (category) references public.accommodation_categories(slug) on update cascade on delete restrict not valid;
alter table public.properties validate constraint properties_category_fk;
-- The CHECK list is now redundant and would block admin-created categories.
alter table public.properties drop constraint if exists properties_category_check;

alter table public.accommodation_categories enable row level security;
revoke all on public.accommodation_categories from anon, authenticated;
grant select on public.accommodation_categories to anon, authenticated;
grant insert, update on public.accommodation_categories to authenticated;
grant all on public.accommodation_categories to service_role;
create policy "Public reads active categories" on public.accommodation_categories
  for select to anon, authenticated using (is_active or public.is_administrator());
create policy "Administrators insert categories" on public.accommodation_categories
  for insert to authenticated with check (public.is_administrator());
create policy "Administrators update categories" on public.accommodation_categories
  for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create trigger accommodation_categories_touch before update on public.accommodation_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Cached geography on properties (search, destination counts, SEO routes avoid recursive CTEs).
--    Also adds a currency column for international readiness. Existing rows default to NGN.
-- ---------------------------------------------------------------------------
alter table public.properties
  add column if not exists city_location_id uuid references public.location_nodes(id) on delete restrict,
  add column if not exists state_location_id uuid references public.location_nodes(id) on delete restrict,
  add column if not exists currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$');
create index if not exists properties_city_status_idx on public.properties(city_location_id, approval_status, is_active) where city_location_id is not null;
create index if not exists properties_state_idx on public.properties(state_location_id) where state_location_id is not null;
create index if not exists properties_geo_idx on public.properties(latitude, longitude) where latitude is not null and longitude is not null;

create or replace function public.properties_cache_geography()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.city_location_id  := public.location_ancestor_id(new.location_id, 'city_town');
  new.state_location_id := public.location_ancestor_id(new.location_id, 'state');
  return new;
end;
$$;
drop trigger if exists properties_cache_geography on public.properties;
create trigger properties_cache_geography before insert or update of location_id on public.properties
for each row execute function public.properties_cache_geography();

-- Do not bump the public "last updated" timestamp for no-op saves or cache-only changes.
create or replace function public.touch_property_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['updated_at','city_location_id','state_location_id'])
       = (to_jsonb(old) - array['updated_at','city_location_id','state_location_id']) then
    new.updated_at := old.updated_at;
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Backfill (no-op for updated_at thanks to the function above).
update public.properties set location_id = location_id where city_location_id is null or state_location_id is null;

-- ---------------------------------------------------------------------------
-- 3. Destination approved-property counts were never maintained (001 left it for "later").
--    Without this the publication gate (minimum approved properties) can never pass.
--    CAUTION: the backfill below overwrites destination_quality_metrics.approved_property_count with the
--    true count and may auto-unpublish a destination that was published against a manual count.
--    Review preflight check 6 before applying.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_destination_property_count(p_city_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_city_id is null then return; end if;
  insert into public.destination_quality_metrics (location_id, approved_property_count, metrics_updated_at)
  select p_city_id, count(*)::integer, now()
  from public.properties
  where city_location_id = p_city_id and approval_status = 'approved' and is_active
  on conflict (location_id) do update
    set approved_property_count = excluded.approved_property_count, metrics_updated_at = now();
end;
$$;
revoke all on function public.refresh_destination_property_count(uuid) from public, anon, authenticated;
grant execute on function public.refresh_destination_property_count(uuid) to service_role;

create or replace function public.properties_refresh_destination_count()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op in ('INSERT','UPDATE') then perform public.refresh_destination_property_count(new.city_location_id); end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.city_location_id is distinct from new.city_location_id) then
    perform public.refresh_destination_property_count(old.city_location_id);
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists properties_destination_count on public.properties;
create trigger properties_destination_count
after insert or delete or update of approval_status, is_active, city_location_id on public.properties
for each row execute function public.properties_refresh_destination_count();

select public.refresh_destination_property_count(c.city_location_id)
from (select distinct city_location_id from public.properties where city_location_id is not null) c;

-- ---------------------------------------------------------------------------
-- 4. Amenities (normalised) mirrored from the existing text[] columns.
-- ---------------------------------------------------------------------------
create table if not exists public.amenities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 60),
  name text not null check (length(trim(name)) between 1 and 80),
  group_name text not null default 'general',
  status text not null default 'pending_review' check (status in ('active','pending_review','retired')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.property_amenities (
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (property_id, amenity_id)
);
create index if not exists property_amenities_amenity_idx on public.property_amenities(amenity_id);

create table if not exists public.room_amenities (
  id uuid primary key default gen_random_uuid(),
  room_category_id uuid references public.property_room_categories(id) on delete cascade,
  apartment_unit_id uuid references public.property_apartment_units(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((room_category_id is null) <> (apartment_unit_id is null))
);
create unique index if not exists room_amenities_room_uidx on public.room_amenities(room_category_id, amenity_id) where room_category_id is not null;
create unique index if not exists room_amenities_unit_uidx on public.room_amenities(apartment_unit_id, amenity_id) where apartment_unit_id is not null;
create index if not exists room_amenities_amenity_idx on public.room_amenities(amenity_id);

create or replace function public.amenity_slug(p_name text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select nullif(trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')), '')
$$;

-- Returns amenity ids for the given free-text names, creating 'pending_review' rows for unknown names.
create or replace function public.ensure_amenities(p_names text[])
returns uuid[] language plpgsql security definer set search_path = public, pg_temp as $$
declare ids uuid[];
begin
  insert into public.amenities (slug, name, status)
  select distinct on (public.amenity_slug(n)) public.amenity_slug(n), left(trim(n), 80), 'pending_review'
  from unnest(coalesce(p_names, '{}'::text[])) n
  where public.amenity_slug(n) is not null and length(public.amenity_slug(n)) <= 60
  on conflict (slug) do nothing;
  select coalesce(array_agg(a.id), '{}'::uuid[]) into ids
  from public.amenities a
  where a.slug in (select public.amenity_slug(n) from unnest(coalesce(p_names, '{}'::text[])) n);
  return ids;
end;
$$;
revoke all on function public.ensure_amenities(text[]) from public, anon, authenticated;
grant execute on function public.ensure_amenities(text[]) to service_role;

create or replace function public.sync_amenity_links()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare ids uuid[];
begin
  if tg_op = 'UPDATE' and new.amenities is not distinct from old.amenities then return new; end if;
  ids := public.ensure_amenities(new.amenities);
  if tg_table_name = 'properties' then
    delete from public.property_amenities where property_id = new.id and amenity_id <> all (ids);
    insert into public.property_amenities (property_id, amenity_id) select new.id, unnest(ids) on conflict do nothing;
  elsif tg_table_name = 'property_room_categories' then
    delete from public.room_amenities where room_category_id = new.id and amenity_id <> all (ids);
    insert into public.room_amenities (room_category_id, amenity_id) select new.id, unnest(ids) on conflict do nothing;
  else
    delete from public.room_amenities where apartment_unit_id = new.id and amenity_id <> all (ids);
    insert into public.room_amenities (apartment_unit_id, amenity_id) select new.id, unnest(ids) on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists properties_sync_amenities on public.properties;
create trigger properties_sync_amenities after insert or update of amenities on public.properties
for each row execute function public.sync_amenity_links();
drop trigger if exists room_categories_sync_amenities on public.property_room_categories;
create trigger room_categories_sync_amenities after insert or update of amenities on public.property_room_categories
for each row execute function public.sync_amenity_links();
drop trigger if exists apartment_units_sync_amenities on public.property_apartment_units;
create trigger apartment_units_sync_amenities after insert or update of amenities on public.property_apartment_units
for each row execute function public.sync_amenity_links();

-- Backfill. Free-text values become 'pending_review' amenities so an administrator can curate them.
select public.ensure_amenities(coalesce(array_agg(distinct v), '{}'::text[]))
from (
  select unnest(amenities) as v from public.properties
  union select unnest(amenities) from public.property_room_categories
  union select unnest(amenities) from public.property_apartment_units
) s;
insert into public.property_amenities (property_id, amenity_id)
select distinct p.id, a.id from public.properties p
join lateral unnest(p.amenities) n on true
join public.amenities a on a.slug = public.amenity_slug(n)
on conflict do nothing;
insert into public.room_amenities (room_category_id, amenity_id)
select distinct r.id, a.id from public.property_room_categories r
join lateral unnest(r.amenities) n on true
join public.amenities a on a.slug = public.amenity_slug(n)
on conflict do nothing;
insert into public.room_amenities (apartment_unit_id, amenity_id)
select distinct u.id, a.id from public.property_apartment_units u
join lateral unnest(u.amenities) n on true
join public.amenities a on a.slug = public.amenity_slug(n)
on conflict do nothing;

alter table public.amenities enable row level security;
alter table public.property_amenities enable row level security;
alter table public.room_amenities enable row level security;
revoke all on public.amenities, public.property_amenities, public.room_amenities from anon, authenticated;
grant select on public.amenities to anon, authenticated;
grant insert, update on public.amenities to authenticated;
grant select on public.property_amenities, public.room_amenities to authenticated;
grant all on public.amenities, public.property_amenities, public.room_amenities to service_role;
create policy "Public reads active amenities" on public.amenities
  for select to anon, authenticated using (status = 'active' or public.is_administrator());
create policy "Administrators insert amenities" on public.amenities
  for insert to authenticated with check (public.is_administrator());
create policy "Administrators update amenities" on public.amenities
  for update to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Providers and administrators read property amenities" on public.property_amenities
  for select to authenticated using (public.can_manage_property(property_id) or public.is_administrator());
create policy "Providers and administrators read room amenities" on public.room_amenities
  for select to authenticated using (
    public.is_administrator()
    or exists (select 1 from public.property_room_categories r where r.id = room_category_id and public.can_manage_property(r.property_id))
    or exists (select 1 from public.property_apartment_units u where u.id = apartment_unit_id and public.can_manage_property(u.property_id))
  );
create trigger amenities_touch before update on public.amenities for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. property_contacts (multiple contacts per property), mirrored from the existing contact columns.
-- ---------------------------------------------------------------------------
create table if not exists public.property_contacts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  kind text not null check (kind in ('phone','whatsapp','email','website','other')),
  value text not null check (length(trim(value)) between 3 and 254),
  label text check (label is null or length(label) <= 80),
  is_primary boolean not null default false,
  is_public boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'email' or position('@' in value) > 1),
  check (kind <> 'website' or value ~ '^https://')
);
create unique index if not exists property_contacts_primary_uidx on public.property_contacts(property_id, kind) where is_primary;
create index if not exists property_contacts_property_idx on public.property_contacts(property_id, display_order);

create or replace function public.sync_property_contacts()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if tg_op = 'UPDATE'
     and (new.phone_number, new.whatsapp_number, new.contact_email, new.website_url)
         is not distinct from (old.phone_number, old.whatsapp_number, old.contact_email, old.website_url) then
    return new;
  end if;
  for r in
    select * from (values ('phone', new.phone_number), ('whatsapp', new.whatsapp_number),
                          ('email', new.contact_email), ('website', new.website_url)) as t(kind, val)
  loop
    if nullif(trim(coalesce(r.val, '')), '') is null
       or length(trim(r.val)) not between 3 and 254
       or (r.kind = 'email' and position('@' in r.val) <= 1)
       or (r.kind = 'website' and trim(r.val) !~ '^https://') then
      delete from public.property_contacts where property_id = new.id and kind = r.kind and is_primary;
    else
      insert into public.property_contacts (property_id, kind, value, is_primary)
      values (new.id, r.kind, trim(r.val), true)
      on conflict (property_id, kind) where is_primary do update set value = excluded.value, updated_at = now();
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists properties_sync_contacts on public.properties;
create trigger properties_sync_contacts after insert or update of phone_number, whatsapp_number, contact_email, website_url on public.properties
for each row execute function public.sync_property_contacts();

insert into public.property_contacts (property_id, kind, value, is_primary)
select id, 'phone', trim(phone_number), true from public.properties
where length(trim(coalesce(phone_number, ''))) between 3 and 254
on conflict (property_id, kind) where is_primary do nothing;
insert into public.property_contacts (property_id, kind, value, is_primary)
select id, 'whatsapp', trim(whatsapp_number), true from public.properties
where length(trim(coalesce(whatsapp_number, ''))) between 3 and 254
on conflict (property_id, kind) where is_primary do nothing;
insert into public.property_contacts (property_id, kind, value, is_primary)
select id, 'email', trim(contact_email), true from public.properties
where length(trim(coalesce(contact_email, ''))) between 3 and 254 and position('@' in trim(contact_email)) > 1
on conflict (property_id, kind) where is_primary do nothing;
insert into public.property_contacts (property_id, kind, value, is_primary)
select id, 'website', trim(website_url), true from public.properties
where length(trim(coalesce(website_url, ''))) between 3 and 254 and trim(website_url) ~ '^https://'
on conflict (property_id, kind) where is_primary do nothing;

alter table public.property_contacts enable row level security;
revoke all on public.property_contacts from anon, authenticated;
grant select on public.property_contacts to authenticated;
grant all on public.property_contacts to service_role;
create policy "Providers and administrators read property contacts" on public.property_contacts
  for select to authenticated using (public.can_manage_property(property_id) or public.is_administrator());
create trigger property_contacts_touch before update on public.property_contacts for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Media: storage metadata and room/unit images.
--    property_media is the "property_images" entity (it also holds video links/uploads).
-- ---------------------------------------------------------------------------
alter table public.property_media
  add column if not exists source text not null default 'external_link' check (source in ('external_link','upload')),
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text check (mime_type is null or mime_type in ('image/jpeg','image/png','image/webp','video/mp4')),
  add column if not exists size_bytes bigint check (size_bytes is null or size_bytes > 0),
  add column if not exists width_px integer check (width_px is null or width_px > 0),
  add column if not exists height_px integer check (height_px is null or height_px > 0),
  add column if not exists content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;
alter table public.property_media drop constraint if exists property_media_source_path_check;
alter table public.property_media add constraint property_media_source_path_check
  check ((source = 'upload') = (storage_path is not null));
create index if not exists property_media_uploaded_by_idx on public.property_media(uploaded_by) where uploaded_by is not null;

create table if not exists public.room_images (
  id uuid primary key default gen_random_uuid(),
  room_category_id uuid references public.property_room_categories(id) on delete cascade,
  apartment_unit_id uuid references public.property_apartment_units(id) on delete cascade,
  media_url text not null check (media_url ~ '^https://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  storage_bucket text,
  storage_path text,
  alt_text text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((room_category_id is null) <> (apartment_unit_id is null))
);
create index if not exists room_images_room_idx on public.room_images(room_category_id, is_active, display_order) where room_category_id is not null;
create index if not exists room_images_unit_idx on public.room_images(apartment_unit_id, is_active, display_order) where apartment_unit_id is not null;
create index if not exists room_images_uploaded_by_idx on public.room_images(uploaded_by) where uploaded_by is not null;

alter table public.room_images enable row level security;
revoke all on public.room_images from anon, authenticated;
grant select, insert, update, delete on public.room_images to authenticated;
grant all on public.room_images to service_role;
create policy "Providers and administrators manage room images" on public.room_images
  for all to authenticated
  using (
    public.is_administrator()
    or exists (select 1 from public.property_room_categories r where r.id = room_category_id and public.can_manage_property(r.property_id))
    or exists (select 1 from public.property_apartment_units u where u.id = apartment_unit_id and public.can_manage_property(u.property_id))
  )
  with check (
    public.is_administrator()
    or exists (select 1 from public.property_room_categories r where r.id = room_category_id and public.can_manage_property(r.property_id))
    or exists (select 1 from public.property_apartment_units u where u.id = apartment_unit_id and public.can_manage_property(u.property_id))
  );

-- ---------------------------------------------------------------------------
-- 7. price_history: every price/basis change is recorded; the first row per record is an honest
--    'baseline' (current price, dated by its existing price_updated_at). No history is invented.
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_category_id uuid references public.property_room_categories(id) on delete cascade,
  apartment_unit_id uuid references public.property_apartment_units(id) on delete cascade,
  price_amount numeric(14,2) not null check (price_amount >= 0),
  price_basis text check (price_basis is null or price_basis in ('night','day','week','month','stay','other')),
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  source text not null default 'change' check (source in ('baseline','change')),
  changed_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  check (room_category_id is null or apartment_unit_id is null)
);
create index if not exists price_history_property_idx on public.price_history(property_id, recorded_at desc);
create index if not exists price_history_room_idx on public.price_history(room_category_id, recorded_at desc) where room_category_id is not null;
create index if not exists price_history_unit_idx on public.price_history(apartment_unit_id, recorded_at desc) where apartment_unit_id is not null;
create index if not exists price_history_changed_by_idx on public.price_history(changed_by) where changed_by is not null;

create or replace function public.record_price_history()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_property uuid; v_room uuid; v_unit uuid; v_currency char(3);
begin
  if tg_op = 'UPDATE' and new.price_amount is not distinct from old.price_amount
     and new.price_basis is not distinct from old.price_basis then
    return new;
  end if;
  if new.price_amount is null then return new; end if;
  if tg_table_name = 'properties' then v_property := new.id;
  elsif tg_table_name = 'property_room_categories' then v_property := new.property_id; v_room := new.id;
  else v_property := new.property_id; v_unit := new.id;
  end if;
  select currency into v_currency from public.properties where id = v_property;
  insert into public.price_history (property_id, room_category_id, apartment_unit_id, price_amount, price_basis, currency, changed_by)
  values (v_property, v_room, v_unit, new.price_amount, new.price_basis, coalesce(v_currency, 'NGN'), auth.uid());
  return new;
end;
$$;
drop trigger if exists properties_price_history on public.properties;
create trigger properties_price_history after insert or update of price_amount, price_basis on public.properties
for each row execute function public.record_price_history();
drop trigger if exists room_categories_price_history on public.property_room_categories;
create trigger room_categories_price_history after insert or update of price_amount, price_basis on public.property_room_categories
for each row execute function public.record_price_history();
drop trigger if exists apartment_units_price_history on public.property_apartment_units;
create trigger apartment_units_price_history after insert or update of price_amount, price_basis on public.property_apartment_units
for each row execute function public.record_price_history();

insert into public.price_history (property_id, price_amount, price_basis, currency, source, recorded_at)
select p.id, p.price_amount, p.price_basis, p.currency, 'baseline', coalesce(p.price_updated_at, p.created_at)
from public.properties p
where p.price_amount is not null
  and not exists (select 1 from public.price_history h where h.property_id = p.id and h.room_category_id is null and h.apartment_unit_id is null);
insert into public.price_history (property_id, room_category_id, price_amount, price_basis, currency, source, recorded_at)
select r.property_id, r.id, r.price_amount, r.price_basis, p.currency, 'baseline', coalesce(r.price_updated_at, r.created_at)
from public.property_room_categories r join public.properties p on p.id = r.property_id
where r.price_amount is not null
  and not exists (select 1 from public.price_history h where h.room_category_id = r.id);
insert into public.price_history (property_id, apartment_unit_id, price_amount, price_basis, currency, source, recorded_at)
select u.property_id, u.id, u.price_amount, u.price_basis, p.currency, 'baseline', coalesce(u.price_updated_at, u.created_at)
from public.property_apartment_units u join public.properties p on p.id = u.property_id
where u.price_amount is not null
  and not exists (select 1 from public.price_history h where h.apartment_unit_id = u.id);

alter table public.price_history enable row level security;
revoke all on public.price_history from anon, authenticated;
grant select on public.price_history to authenticated;
grant all on public.price_history to service_role;
create policy "Providers and administrators read price history" on public.price_history
  for select to authenticated using (public.can_manage_property(property_id) or public.is_administrator());

-- ---------------------------------------------------------------------------
-- 8. Nearby landmarks: optionally link to the verified landmark nodes in the location hierarchy.
-- ---------------------------------------------------------------------------
alter table public.property_nearby_landmarks
  add column if not exists landmark_location_id uuid references public.location_nodes(id) on delete set null,
  add column if not exists distance_metres integer check (distance_metres is null or distance_metres >= 0),
  add column if not exists travel_mode text check (travel_mode is null or travel_mode in ('walking','driving','transit','other'));
create index if not exists property_nearby_landmarks_location_idx on public.property_nearby_landmarks(landmark_location_id) where landmark_location_id is not null;

-- ---------------------------------------------------------------------------
-- 9. Administrator access to child records and report triage.
--    007 gave administrators the properties table but not its children, so the admin console could
--    not read a listing's media/rooms during moderation, and listing reports could not be triaged.
-- ---------------------------------------------------------------------------
create policy "Administrators manage room categories" on public.property_room_categories
  for all to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators manage apartment units" on public.property_apartment_units
  for all to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators manage property media" on public.property_media
  for all to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators manage nearby landmarks" on public.property_nearby_landmarks
  for all to authenticated using (public.is_administrator()) with check (public.is_administrator());
create policy "Administrators read enquiries" on public.property_enquiries
  for select to authenticated using (public.is_administrator());

alter table public.property_listing_reports
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists resolution_note text check (resolution_note is null or length(resolution_note) <= 2000),
  add column if not exists resolved_at timestamptz;
create index if not exists property_listing_reports_assigned_idx on public.property_listing_reports(assigned_to) where assigned_to is not null;
grant update (status, assigned_to, resolution_note, resolved_at) on public.property_listing_reports to authenticated;
create policy "Support staff triage listing reports" on public.property_listing_reports
  for update to authenticated
  using (public.has_staff_permission('support.manage'))
  with check (public.has_staff_permission('support.manage'));
