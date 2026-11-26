-- Hotelnearby Prompt 13 preflight. READ ONLY: contains only SELECT statements.
-- Run against the target database (dev, then staging, then production snapshot) BEFORE applying 008-012.
-- Paste the results back for review. Nothing here modifies data.

-- 1. Which migrations has this database recorded?
select version, name from supabase_migrations.schema_migrations order by version;

-- 2. Row counts of the tables the new migrations touch.
select 'properties' t, count(*) from public.properties union all
select 'property_media', count(*) from public.property_media union all
select 'property_enquiries', count(*) from public.property_enquiries union all
select 'property_listing_reports', count(*) from public.property_listing_reports union all
select 'provider_organisations', count(*) from public.provider_organisations union all
select 'admin_audit_logs', count(*) from public.admin_audit_logs;

-- 3. Duplicate root locations (would block migration 008's unique index).
select slug, count(*) from public.location_nodes where parent_id is null group by slug having count(*) > 1;

-- 4. Properties without an organisation (cannot get a Starter subscription; not manageable by providers).
select id, name, approval_status from public.properties where organisation_id is null;

-- 5. Properties already over the Starter photo limit (not deleted by the migration; only new uploads are blocked).
select property_id, count(*) as active_images from public.property_media
where media_type = 'image' and is_active group by property_id having count(*) > 8 order by 2 desc;

-- 6. Destination counts: stored value vs the true count that migration 009 will write.
--    Rows where they differ may change publication state automatically.
with recursive up as (
  select p.id as property_id, n.id, n.parent_id, n.level
  from public.properties p join public.location_nodes n on n.id = p.location_id
  where p.approval_status = 'approved' and p.is_active
  union all
  select u.property_id, n.id, n.parent_id, n.level
  from up u join public.location_nodes n on n.id = u.parent_id
), true_counts as (
  select id as city_id, count(distinct property_id) as true_count from up where level = 'city_town' group by id
)
select l.name, dp.publication_status, coalesce(m.approved_property_count, 0) as stored_count, coalesce(t.true_count, 0) as true_count
from public.destination_profiles dp
join public.location_nodes l on l.id = dp.location_id
left join public.destination_quality_metrics m on m.location_id = dp.location_id
left join true_counts t on t.city_id = dp.location_id
where coalesce(m.approved_property_count, 0) <> coalesce(t.true_count, 0);

-- 7. Contact values that will NOT be copied into property_contacts (columns stay untouched).
select id, name, phone_number, whatsapp_number, contact_email, website_url from public.properties
where (phone_number is not null and length(trim(phone_number)) not between 3 and 254)
   or (whatsapp_number is not null and length(trim(whatsapp_number)) not between 3 and 254)
   or (contact_email is not null and (position('@' in contact_email) <= 1 or length(trim(contact_email)) > 254));

-- 8. Distinct free-text amenity values that will become 'pending_review' amenities.
select count(distinct lower(trim(v))) as distinct_amenity_values
from (select unnest(amenities) v from public.properties
      union all select unnest(amenities) from public.property_room_categories
      union all select unnest(amenities) from public.property_apartment_units) s;

-- 9. Memberships whose profile role would not have been restricted by the old approval guard (finding S1).
select m.user_id, m.organisation_id, p.role from public.provider_memberships m
join public.profiles p on p.id = m.user_id where p.role not in ('provider_owner','provider_staff','administrator');

-- 10. Policies and grants on tables holding personal data (for manual review).
select schemaname, tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('profiles','property_enquiries','property_listing_reports','admin_audit_logs')
order by tablename, policyname;
