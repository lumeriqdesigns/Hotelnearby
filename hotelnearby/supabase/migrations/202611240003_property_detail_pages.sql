-- Prompt 8: public property detail pages, contact requests and listing reports.
-- No sample properties, rooms, units, media or enquiries are seeded.

alter table public.properties
  add column if not exists address_line text,
  add column if not exists latitude double precision check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude is null or longitude between -180 and 180),
  add column if not exists phone_number text,
  add column if not exists whatsapp_number text,
  add column if not exists contact_email text,
  add column if not exists website_url text check (website_url is null or website_url ~ '^https://'),
  add column if not exists house_rules text,
  add column if not exists check_in_information text,
  add column if not exists check_out_information text,
  add column if not exists price_updated_at timestamptz;

-- Hotel room categories are bookable room TYPES (e.g. Standard Double), not
-- individually tracked apartments. Apartment units are separate records.
create table public.property_room_categories (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  price_amount numeric(14,2) check (price_amount is null or price_amount >= 0),
  price_basis text not null check (price_basis in ('night','day','week','month','stay','other')),
  guest_capacity integer check (guest_capacity is null or guest_capacity >= 1),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(4,1) check (bathrooms is null or bathrooms >= 0),
  amenities text[] not null default '{}',
  display_order integer not null default 0,
  is_active boolean not null default true,
  price_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index property_room_categories_public_idx on public.property_room_categories(property_id, is_active, display_order);

create table public.property_apartment_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_name text not null check (length(trim(unit_name)) between 2 and 120),
  description text not null default '',
  price_amount numeric(14,2) check (price_amount is null or price_amount >= 0),
  price_basis text not null check (price_basis in ('night','day','week','month','stay','other')),
  guest_capacity integer check (guest_capacity is null or guest_capacity >= 1),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(4,1) check (bathrooms is null or bathrooms >= 0),
  amenities text[] not null default '{}',
  display_order integer not null default 0,
  is_active boolean not null default true,
  price_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index property_apartment_units_public_idx on public.property_apartment_units(property_id, is_active, display_order);

-- Keep the public date honest: it changes only when the actual price or basis changes.
create or replace function public.set_public_price_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.price_amount is not null and new.price_updated_at is null then new.price_updated_at = now(); end if;
  elsif new.price_amount is distinct from old.price_amount or new.price_basis is distinct from old.price_basis then
    new.price_updated_at = now();
  end if;
  return new;
end;
$$;
create trigger properties_price_updated_at before insert or update of price_amount, price_basis on public.properties
for each row execute function public.set_public_price_updated_at();
create trigger room_categories_price_updated_at before insert or update of price_amount, price_basis on public.property_room_categories
for each row execute function public.set_public_price_updated_at();
create trigger apartment_units_price_updated_at before insert or update of price_amount, price_basis on public.property_apartment_units
for each row execute function public.set_public_price_updated_at();

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  media_url text not null check (media_url ~ '^https://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~ '^https://'),
  alt_text text not null default '',
  caption text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index property_media_public_idx on public.property_media(property_id, is_active, display_order);

create table public.property_nearby_landmarks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  landmark_name text not null check (length(trim(landmark_name)) between 2 and 160),
  distance_description text,
  display_order integer not null default 0,
  is_active boolean not null default true
);
create index property_nearby_landmarks_public_idx on public.property_nearby_landmarks(property_id, is_active, display_order);

create table public.property_enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  sender_name text not null check (length(trim(sender_name)) between 2 and 120),
  sender_contact text not null check (length(trim(sender_contact)) between 5 and 180),
  message text not null check (length(trim(message)) between 10 and 3000),
  status text not null default 'new' check (status in ('new','read','closed')),
  created_at timestamptz not null default now()
);
create index property_enquiries_property_date_idx on public.property_enquiries(property_id, created_at desc);

create table public.property_listing_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reporter_name text not null check (length(trim(reporter_name)) between 2 and 120),
  reason text not null check (reason in ('incorrect-information','unavailable-property','suspected-fraud','inappropriate-content','other')),
  details text not null default '' check (length(details) <= 2000),
  reporter_contact text check (reporter_contact is null or length(reporter_contact) <= 180),
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

-- Child records are deliberately accessed only through the approved-property RPC.
alter table public.property_room_categories enable row level security;
alter table public.property_apartment_units enable row level security;
alter table public.property_media enable row level security;
alter table public.property_nearby_landmarks enable row level security;
alter table public.property_enquiries enable row level security;
alter table public.property_listing_reports enable row level security;
revoke all on public.property_enquiries, public.property_listing_reports from anon, authenticated;
revoke all on public.property_room_categories, public.property_apartment_units, public.property_media, public.property_nearby_landmarks from anon, authenticated;
grant all on public.property_room_categories, public.property_apartment_units, public.property_media, public.property_nearby_landmarks, public.property_enquiries, public.property_listing_reports to service_role;

create or replace function public.get_public_property_detail(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'slug', p.slug, 'category', p.category,
    'description', p.description, 'cover_image_url', p.cover_image_url, 'address_line', p.address_line,
    'latitude', p.latitude, 'longitude', p.longitude,
    'price_amount', p.price_amount, 'price_basis', p.price_basis,
    'price_updated_at', p.price_updated_at,
    'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms, 'guest_capacity', p.guest_capacity,
    'amenities', p.amenities, 'features', p.features,
    'phone_number', p.phone_number, 'whatsapp_number', p.whatsapp_number,
    'contact_email', p.contact_email, 'website_url', p.website_url,
    'house_rules', p.house_rules, 'check_in_information', p.check_in_information,
    'check_out_information', p.check_out_information,
    'verification_status', p.verification_status,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'state_name', loc.state_name, 'city_name', loc.city_name,
    'neighbourhood_name', loc.neighbourhood_name, 'landmark_name', loc.landmark_name,
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'type', m.media_type, 'url', m.media_url, 'thumbnail_url', m.thumbnail_url, 'alt', m.alt_text, 'caption', m.caption) order by m.display_order, m.created_at) from public.property_media m where m.property_id = p.id and m.is_active), '[]'::jsonb),
    'room_categories', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description, 'price_amount', r.price_amount, 'price_basis', r.price_basis, 'guest_capacity', r.guest_capacity, 'bedrooms', r.bedrooms, 'bathrooms', r.bathrooms, 'amenities', r.amenities, 'price_updated_at', r.price_updated_at) order by r.display_order, r.name) from public.property_room_categories r where r.property_id = p.id and r.is_active), '[]'::jsonb),
    'apartment_units', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.unit_name, 'description', u.description, 'price_amount', u.price_amount, 'price_basis', u.price_basis, 'guest_capacity', u.guest_capacity, 'bedrooms', u.bedrooms, 'bathrooms', u.bathrooms, 'amenities', u.amenities, 'price_updated_at', u.price_updated_at) order by u.display_order, u.unit_name) from public.property_apartment_units u where u.property_id = p.id and u.is_active), '[]'::jsonb),
    'nearby_landmarks', coalesce((select jsonb_agg(jsonb_build_object('name', n.landmark_name, 'distance', n.distance_description) order by n.display_order, n.landmark_name) from public.property_nearby_landmarks n where n.property_id = p.id and n.is_active), '[]'::jsonb),
    'similar_properties', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'category', s.category, 'price_amount', s.price_amount, 'price_basis', s.price_basis, 'cover_image_url', s.cover_image_url, 'city_name', sl.city_name, 'state_name', sl.state_name, 'verification_status', s.verification_status) order by s.updated_at desc) from (select sp.* from public.properties sp where sp.id <> p.id and sp.approval_status = 'approved' and sp.is_active and (sp.location_id = p.location_id or sp.category = p.category) order by (sp.location_id = p.location_id) desc, sp.updated_at desc limit 4) s left join lateral (select max(x.name) filter (where x.level = 'city_town') as city_name, max(x.name) filter (where x.level = 'state') as state_name from (with recursive a as (select n.id,n.parent_id,n.level,n.name from public.location_nodes n where n.id=s.location_id union all select pn.id,pn.parent_id,pn.level,pn.name from a join public.location_nodes pn on pn.id=a.parent_id) select * from a) x) sl on true), '[]'::jsonb)
  )
  from public.properties p
  left join lateral (
    with recursive a as (
      select n.id,n.parent_id,n.level,n.name from public.location_nodes n where n.id=p.location_id
      union all select pn.id,pn.parent_id,pn.level,pn.name from a join public.location_nodes pn on pn.id=a.parent_id
    )
    select max(name) filter (where level='state') as state_name,
           max(name) filter (where level='city_town') as city_name,
           max(name) filter (where level='neighbourhood') as neighbourhood_name,
           max(name) filter (where level='landmark') as landmark_name from a
  ) loc on true
  where p.slug = p_slug and p.approval_status = 'approved' and p.is_active
  limit 1;
$$;
revoke all on function public.get_public_property_detail(text) from public;
grant execute on function public.get_public_property_detail(text) to anon, authenticated;

create or replace function public.submit_public_property_contact(
  p_slug text, p_sender_name text, p_sender_contact text, p_message text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  if length(trim(coalesce(p_sender_name,''))) not between 2 and 120 or
     length(trim(coalesce(p_sender_contact,''))) not between 5 and 180 or
     length(trim(coalesce(p_message,''))) not between 10 and 3000 then
    raise exception 'Please provide valid contact details and a message';
  end if;
  select id into target_id from public.properties where slug=p_slug and approval_status='approved' and is_active;
  if target_id is null then return false; end if;
  if (select count(*) from public.property_enquiries where property_id=target_id and sender_contact=trim(p_sender_contact) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Please wait before sending another enquiry';
  end if;
  insert into public.property_enquiries(property_id,sender_name,sender_contact,message)
  values(target_id,trim(p_sender_name),trim(p_sender_contact),trim(p_message));
  return true;
end;
$$;
revoke all on function public.submit_public_property_contact(text,text,text,text) from public;
grant execute on function public.submit_public_property_contact(text,text,text,text) to anon, authenticated;

create or replace function public.submit_public_property_report(
  p_slug text, p_reporter_name text, p_reason text, p_details text default '', p_reporter_contact text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  if length(trim(coalesce(p_reporter_name,''))) not between 2 and 120 or p_reason not in ('incorrect-information','unavailable-property','suspected-fraud','inappropriate-content','other') or length(coalesce(p_details,'')) > 2000 or length(coalesce(p_reporter_contact,'')) > 180 then
    raise exception 'Invalid listing report';
  end if;
  select id into target_id from public.properties where slug=p_slug and approval_status='approved' and is_active;
  if target_id is null then return false; end if;
  if nullif(trim(p_reporter_contact),'') is not null and (select count(*) from public.property_listing_reports where property_id=target_id and reporter_contact=trim(p_reporter_contact) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Please wait before submitting another report';
  end if;
  insert into public.property_listing_reports(property_id,reporter_name,reason,details,reporter_contact)
  values(target_id,trim(p_reporter_name),p_reason,trim(coalesce(p_details,'')),nullif(trim(p_reporter_contact),''));
  return true;
end;
$$;
revoke all on function public.submit_public_property_report(text,text,text,text,text) from public;
grant execute on function public.submit_public_property_report(text,text,text,text,text) to anon, authenticated;
