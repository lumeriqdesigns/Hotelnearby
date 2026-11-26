-- Nearby discovery and events directory runtime extensions.
-- Public publication requires a verified source, human review, and reliable coordinates.

alter table public.attractions drop constraint if exists attractions_category_check;
alter table public.attractions add constraint attractions_category_check
  check (category in ('attraction','museum','heritage','nature','religious','entertainment','sport','gallery','cultural_site','zoo','beach','waterfall','monument','other'));

create table if not exists public.attraction_related_properties (
  attraction_id uuid not null references public.attractions(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  display_order integer not null default 0,
  primary key (attraction_id, property_id)
);
create table if not exists public.event_related_properties (
  event_id uuid not null references public.events(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  display_order integer not null default 0,
  primary key (event_id, property_id)
);
create index if not exists attraction_related_properties_property_idx on public.attraction_related_properties(property_id);
create index if not exists event_related_properties_property_idx on public.event_related_properties(property_id);

alter table public.attraction_related_properties enable row level security;
alter table public.event_related_properties enable row level security;
grant select on public.attraction_related_properties, public.event_related_properties to anon, authenticated;
grant insert, update, delete on public.attraction_related_properties, public.event_related_properties to authenticated;
grant all on public.attraction_related_properties, public.event_related_properties to service_role;
create policy "Public reads related properties for published attractions" on public.attraction_related_properties for select to anon, authenticated
  using (exists (select 1 from public.attractions a where a.id = attraction_id and a.publication_status = 'published' and a.verification_status = 'verified'));
create policy "Destination staff manage attraction property links" on public.attraction_related_properties for all to authenticated
  using (public.has_staff_permission('destinations.manage')) with check (public.has_staff_permission('destinations.manage'));
create policy "Public reads related properties for published events" on public.event_related_properties for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.publication_status = 'published' and e.verification_status = 'verified'));
create policy "Event staff manage event property links" on public.event_related_properties for all to authenticated
  using (public.has_staff_permission('events.manage')) with check (public.has_staff_permission('events.manage'));


create table if not exists public.business_related_properties (
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  display_order integer not null default 0,
  primary key (business_id, property_id)
);
create index if not exists business_related_properties_property_idx on public.business_related_properties(property_id);
alter table public.business_related_properties enable row level security;
grant select on public.business_related_properties to anon, authenticated;
grant insert, update, delete on public.business_related_properties to authenticated;
grant all on public.business_related_properties to service_role;
create policy "Public reads related properties for published businesses" on public.business_related_properties for select to anon, authenticated
  using (exists (select 1 from public.local_businesses b where b.id = business_id and b.publication_status = 'published' and b.verification_status = 'verified'));
create policy "Destination staff manage business property links" on public.business_related_properties for all to authenticated
  using (public.has_staff_permission('destinations.manage')) with check (public.has_staff_permission('destinations.manage'));

-- A directory item is not published until its pin, source, verification and moderation are complete.
create or replace function public.guard_directory_publication()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.publication_status = 'published' then
    if new.verification_status <> 'verified' or new.reviewed_by is null or new.reviewed_at is null
       or new.published_at is null or nullif(trim(coalesce(new.source_reference,'')), '') is null
       or new.latitude is null or new.longitude is null then
      raise exception 'Publishing requires a verified source, reviewer, publication date and reliable coordinates';
    end if;
    if char_length(trim(coalesce(new.description,''))) < 40 then
      raise exception 'Published directory descriptions must contain at least 40 characters';
    end if;
  end if;
  return new;
end;
$$;
create trigger attractions_publication_guard before insert or update on public.attractions for each row execute function public.guard_directory_publication();
create trigger local_businesses_publication_guard before insert or update on public.local_businesses for each row execute function public.guard_directory_publication();
create trigger events_publication_guard before insert or update on public.events for each row execute function public.guard_directory_publication();

create index if not exists events_public_date_idx on public.events(starts_at) where publication_status = 'published' and verification_status = 'verified';
create index if not exists local_businesses_public_type_idx on public.local_businesses(business_type, location_id) where publication_status = 'published' and verification_status = 'verified';
create index if not exists attractions_public_category_idx on public.attractions(category, location_id) where publication_status = 'published' and verification_status = 'verified';


-- City nodes must be publicly resolvable when a verified nearby item or event exists,
-- even if a full destination editorial profile has not yet met its own publication threshold.
drop policy if exists "Public reads active location hierarchy" on public.location_nodes;
create policy "Public reads active location hierarchy" on public.location_nodes
for select to anon, authenticated using (is_active and (
  level in ('country', 'state')
  or exists (select 1 from public.destination_profiles dp where dp.location_id = location_nodes.id and dp.publication_status = 'published')
  or public.is_within_published_destination(id)
  or (level = 'city_town' and (
    exists (select 1 from public.attractions a where a.location_id = location_nodes.id and a.publication_status = 'published' and a.verification_status = 'verified')
    or exists (select 1 from public.local_businesses b where b.location_id = location_nodes.id and b.publication_status = 'published' and b.verification_status = 'verified')
    or exists (select 1 from public.events e where e.location_id = location_nodes.id and e.publication_status = 'published' and e.verification_status = 'verified')
  ))
));

create policy "Directory staff read active city locations" on public.location_nodes
for select to authenticated using (
  is_active and level = 'city_town'
  and (public.has_staff_permission('destinations.manage') or public.has_staff_permission('events.manage'))
);

create or replace function public.guard_directory_property_link()
returns trigger language plpgsql set search_path = public as $$
declare directory_location uuid; property_location uuid; property_status text; property_active boolean;
begin
  if tg_table_name = 'attraction_related_properties' then
    select location_id into directory_location from public.attractions where id = new.attraction_id;
  elsif tg_table_name = 'business_related_properties' then
    select location_id into directory_location from public.local_businesses where id = new.business_id;
  else
    select location_id into directory_location from public.events where id = new.event_id;
  end if;
  select location_id, approval_status, is_active into property_location, property_status, property_active
    from public.properties where id = new.property_id;
  if directory_location is null or property_location is null or directory_location <> property_location
     or property_status <> 'approved' or property_active is distinct from true then
    raise exception 'Related accommodation must be an approved active property in the same city or town';
  end if;
  return new;
end;
$$;
create trigger attraction_property_link_guard before insert or update on public.attraction_related_properties for each row execute function public.guard_directory_property_link();
create trigger business_property_link_guard before insert or update on public.business_related_properties for each row execute function public.guard_directory_property_link();
create trigger event_property_link_guard before insert or update on public.event_related_properties for each row execute function public.guard_directory_property_link();
