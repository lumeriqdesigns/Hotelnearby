-- Prompt 13 / migration 012: trust, content, analytics and retention schema.
-- STATUS: PROPOSED. Not applied anywhere. Requires 008-011.
-- Additive only. Public content tables expose only verified/published rows; nothing is seeded as fact.

-- ---------------------------------------------------------------------------
-- 1. Verification records. A paid plan never creates or implies a verification record.
-- ---------------------------------------------------------------------------
create table if not exists public.verification_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  verification_type text not null check (verification_type in ('identity','business_registration','ownership','site_visit','licence','other')),
  status text not null default 'submitted' check (status in ('submitted','in_review','verified','rejected','expired','revoked')),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),   -- private storage paths only, never public URLs
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('verified','rejected','revoked')
         or (reviewed_by is not null and reviewed_at is not null and nullif(trim(coalesce(decision_note, '')), '') is not null)),
  check (status <> 'verified' or valid_from is not null),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);
create index if not exists verification_records_property_idx on public.verification_records(property_id, status);
create index if not exists verification_records_status_idx on public.verification_records(status, created_at desc);
create index if not exists verification_records_submitted_by_idx on public.verification_records(submitted_by) where submitted_by is not null;
create index if not exists verification_records_reviewed_by_idx on public.verification_records(reviewed_by) where reviewed_by is not null;
create trigger verification_records_touch before update on public.verification_records for each row execute function public.set_updated_at();
create trigger verification_records_audit after insert or update or delete on public.verification_records for each row execute function public.audit_row_change();

alter table public.verification_records enable row level security;
revoke all on public.verification_records from anon, authenticated;
grant select on public.verification_records to authenticated;
grant insert (property_id, verification_type, evidence, submitted_by) on public.verification_records to authenticated;
grant update (status, reviewed_by, reviewed_at, decision_note, valid_from, valid_until) on public.verification_records to authenticated;
grant all on public.verification_records to service_role;
create policy "Providers and reviewers read verification records" on public.verification_records
  for select to authenticated using (public.can_manage_property(property_id) or public.has_staff_permission('verification.review'));
create policy "Providers submit verification evidence" on public.verification_records
  for insert to authenticated with check (public.can_manage_property(property_id) and submitted_by = auth.uid() and status = 'submitted');
create policy "Reviewers decide verification" on public.verification_records
  for update to authenticated using (public.has_staff_permission('verification.review')) with check (public.has_staff_permission('verification.review'));

-- ---------------------------------------------------------------------------
-- 2. Reviews. Hotelnearby does not process bookings, so no review is assumed to be from a confirmed guest.
--    evidence_level records what was actually checked, by whom and when.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  reviewer_display_name text not null check (length(trim(reviewer_display_name)) between 2 and 60),
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or length(title) <= 120),
  body text not null check (length(trim(body)) between 20 and 3000),
  stay_month date check (stay_month is null or extract(day from stay_month) = 1),   -- self-reported
  evidence_level text not null default 'unverified' check (evidence_level in ('unverified','evidence_supplied','verified')),
  evidence_note text check (evidence_note is null or length(evidence_note) <= 1000),
  evidence_verified_by uuid references auth.users(id) on delete set null,
  evidence_verified_at timestamptz,
  status text not null default 'pending' check (status in ('pending','published','rejected','removed')),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  moderation_note text check (moderation_note is null or length(moderation_note) <= 1000),
  provider_response text check (provider_response is null or length(provider_response) <= 2000),
  provider_responded_by uuid references auth.users(id) on delete set null,
  provider_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_level <> 'verified'
         or (evidence_verified_by is not null and evidence_verified_at is not null and nullif(trim(coalesce(evidence_note, '')), '') is not null)),
  check (status not in ('published','rejected','removed') or (moderated_by is not null and moderated_at is not null))
);
create unique index if not exists reviews_one_live_per_user_uidx on public.reviews(property_id, user_id)
  where user_id is not null and status in ('pending','published');
create index if not exists reviews_property_public_idx on public.reviews(property_id, created_at desc) where status = 'published';
create index if not exists reviews_status_idx on public.reviews(status, created_at desc);
create index if not exists reviews_user_idx on public.reviews(user_id) where user_id is not null;
create index if not exists reviews_moderated_by_idx on public.reviews(moderated_by) where moderated_by is not null;
create index if not exists reviews_evidence_verified_by_idx on public.reviews(evidence_verified_by) where evidence_verified_by is not null;
create index if not exists reviews_responded_by_idx on public.reviews(provider_responded_by) where provider_responded_by is not null;
create trigger reviews_touch before update on public.reviews for each row execute function public.set_updated_at();
create trigger reviews_audit after update or delete on public.reviews for each row execute function public.audit_row_change();

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
grant insert (property_id, user_id, reviewer_display_name, rating, title, body, stay_month) on public.reviews to authenticated;
grant update (status, moderated_by, moderated_at, moderation_note, evidence_level, evidence_note, evidence_verified_by, evidence_verified_at) on public.reviews to authenticated;
grant all on public.reviews to service_role;
create policy "Authors and moderators read reviews" on public.reviews
  for select to authenticated using (user_id = auth.uid() or public.has_staff_permission('reviews.moderate'));
create policy "Verified-email users submit pending reviews" on public.reviews
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'pending' and evidence_level = 'unverified'
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.email_verified_at is not null)
    and exists (select 1 from public.properties p where p.id = property_id and p.approval_status = 'approved' and p.is_active
                and (p.organisation_id is null or not public.is_provider_member(p.organisation_id)))
  );
create policy "Moderators decide reviews" on public.reviews
  for update to authenticated using (public.has_staff_permission('reviews.moderate')) with check (public.has_staff_permission('reviews.moderate'));

-- Providers may respond to published reviews of their own property. Nothing else on the row is writable by them.
create or replace function public.respond_to_review(p_review_id uuid, p_response text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_property uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if length(trim(coalesce(p_response, ''))) not between 2 and 2000 then raise exception 'Response must be 2-2000 characters'; end if;
  select property_id into v_property from public.reviews where id = p_review_id and status = 'published';
  if v_property is null or not public.can_manage_property(v_property) then return false; end if;
  update public.reviews set provider_response = trim(p_response), provider_responded_by = auth.uid(), provider_responded_at = now()
  where id = p_review_id;
  return true;
end;
$$;
revoke all on function public.respond_to_review(uuid, text) from public, anon;
grant execute on function public.respond_to_review(uuid, text) to authenticated;

-- Public projection: no user ids, moderation notes or evidence internals.
create or replace view public.public_property_reviews with (security_barrier = true) as
select r.id, r.property_id, r.reviewer_display_name, r.rating, r.title, r.body, r.stay_month,
       r.evidence_level, r.provider_response, r.provider_responded_at, r.created_at
from public.reviews r join public.properties p on p.id = r.property_id
where r.status = 'published' and p.approval_status = 'approved' and p.is_active;
grant select on public.public_property_reviews to anon, authenticated;

-- Counts and an honest average over published reviews only. No review => no row, never a default rating.
create or replace view public.property_review_stats with (security_barrier = true) as
select r.property_id, count(*)::integer as review_count,
       round(avg(r.rating)::numeric, 2) as average_rating,
       count(*) filter (where r.evidence_level = 'verified')::integer as verified_review_count
from public.reviews r join public.properties p on p.id = r.property_id
where r.status = 'published' and p.approval_status = 'approved' and p.is_active
group by r.property_id;
grant select on public.property_review_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Nearby directories and events (verified-before-publish, same rule as destination_content_items).
--    Events link out to organiser ticket pages only; Hotelnearby sells no tickets.
-- ---------------------------------------------------------------------------
create table if not exists public.attractions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location_nodes(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (category in ('park','museum','heritage','nature','religious','entertainment','sport','other')),
  description text not null default '' check (length(description) <= 4000),
  address_line text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  image_url text check (image_url is null or image_url ~ '^https://'),
  website_url text check (website_url is null or website_url ~ '^https://'),
  source_reference text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','disputed')),
  publication_status text not null default 'draft' check (publication_status in ('draft','in_review','published','unpublished')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, slug),
  check ((latitude is null) = (longitude is null)),
  check (publication_status <> 'published' or (verification_status = 'verified' and reviewed_by is not null and reviewed_at is not null
         and published_at is not null and length(trim(coalesce(source_reference, ''))) > 0 and length(trim(description)) >= 40))
);
create table if not exists public.local_businesses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location_nodes(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  business_type text not null check (business_type in ('restaurant','cafe','shopping','event_centre','park','gym','spa','hospital','university','airport','transport_terminal','other')),
  description text not null default '' check (length(description) <= 4000),
  address_line text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  phone_number text check (phone_number is null or length(phone_number) <= 40),
  website_url text check (website_url is null or website_url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  opening_hours_note text check (opening_hours_note is null or length(opening_hours_note) <= 500),
  source_reference text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','disputed')),
  publication_status text not null default 'draft' check (publication_status in ('draft','in_review','published','unpublished')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, slug),
  check ((latitude is null) = (longitude is null)),
  check (publication_status <> 'published' or (verification_status = 'verified' and reviewed_by is not null and reviewed_at is not null
         and published_at is not null and length(trim(coalesce(source_reference, ''))) > 0))
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location_nodes(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  event_type text not null check (event_type in ('concert','festival','conference','exhibition','sports','trade_fair','cultural','community','other')),
  description text not null default '' check (length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  time_zone text not null default 'Africa/Lagos' check (length(time_zone) <= 64),
  venue_name text check (venue_name is null or length(venue_name) <= 160),
  address_line text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  organiser_name text not null check (length(trim(organiser_name)) between 2 and 160),
  organiser_contact text check (organiser_contact is null or length(organiser_contact) <= 254),
  website_url text check (website_url is null or website_url ~ '^https://'),
  ticket_url text check (ticket_url is null or ticket_url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  source_reference text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','disputed')),
  publication_status text not null default 'draft' check (publication_status in ('draft','in_review','published','unpublished','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, slug),
  check (ends_at is null or ends_at >= starts_at),
  check ((latitude is null) = (longitude is null)),
  check (publication_status <> 'published' or (verification_status = 'verified' and reviewed_by is not null and reviewed_at is not null
         and published_at is not null and length(trim(coalesce(source_reference, ''))) > 0))
);
create index if not exists attractions_public_idx on public.attractions(location_id, category) where publication_status = 'published';
create index if not exists local_businesses_public_idx on public.local_businesses(location_id, business_type) where publication_status = 'published';
create index if not exists events_public_idx on public.events(location_id, starts_at) where publication_status = 'published';
create index if not exists attractions_geo_idx on public.attractions(latitude, longitude) where latitude is not null;
create index if not exists local_businesses_geo_idx on public.local_businesses(latitude, longitude) where latitude is not null;
create index if not exists events_geo_idx on public.events(latitude, longitude) where latitude is not null;
create index if not exists attractions_reviewed_by_idx on public.attractions(reviewed_by) where reviewed_by is not null;
create index if not exists local_businesses_reviewed_by_idx on public.local_businesses(reviewed_by) where reviewed_by is not null;
create index if not exists events_reviewed_by_idx on public.events(reviewed_by) where reviewed_by is not null;
create index if not exists attractions_name_trgm_idx on public.attractions using gin (name gin_trgm_ops);
create index if not exists local_businesses_name_trgm_idx on public.local_businesses using gin (name gin_trgm_ops);

create trigger attractions_city_guard before insert or update of location_id on public.attractions for each row execute function public.require_city_town_destination();
create trigger local_businesses_city_guard before insert or update of location_id on public.local_businesses for each row execute function public.require_city_town_destination();
create trigger events_city_guard before insert or update of location_id on public.events for each row execute function public.require_city_town_destination();
create trigger attractions_touch before update on public.attractions for each row execute function public.set_updated_at();
create trigger local_businesses_touch before update on public.local_businesses for each row execute function public.set_updated_at();
create trigger events_touch before update on public.events for each row execute function public.set_updated_at();

alter table public.attractions enable row level security;
alter table public.local_businesses enable row level security;
alter table public.events enable row level security;
revoke all on public.attractions, public.local_businesses, public.events from anon, authenticated;
grant select on public.attractions, public.local_businesses, public.events to anon, authenticated;
grant insert, update, delete on public.attractions, public.local_businesses to authenticated;
grant insert, update, delete on public.events to authenticated;
grant all on public.attractions, public.local_businesses, public.events to service_role;
create policy "Public reads verified attractions" on public.attractions for select to anon, authenticated
  using ((publication_status = 'published' and verification_status = 'verified') or public.has_staff_permission('destinations.manage'));
create policy "Staff manage attractions" on public.attractions for all to authenticated
  using (public.has_staff_permission('destinations.manage')) with check (public.has_staff_permission('destinations.manage'));
create policy "Public reads verified local businesses" on public.local_businesses for select to anon, authenticated
  using ((publication_status = 'published' and verification_status = 'verified') or public.has_staff_permission('destinations.manage'));
create policy "Staff manage local businesses" on public.local_businesses for all to authenticated
  using (public.has_staff_permission('destinations.manage')) with check (public.has_staff_permission('destinations.manage'));
create policy "Public reads verified events" on public.events for select to anon, authenticated
  using ((publication_status = 'published' and verification_status = 'verified') or public.has_staff_permission('events.manage'));
create policy "Staff manage events" on public.events for all to authenticated
  using (public.has_staff_permission('events.manage')) with check (public.has_staff_permission('events.manage'));

-- ---------------------------------------------------------------------------
-- 4. Travel Journal
-- ---------------------------------------------------------------------------
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '' check (length(description) <= 500),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 5 and 160),
  excerpt text not null default '' check (length(excerpt) <= 400),
  body_markdown text not null default '',
  category_id uuid not null references public.blog_categories(id) on delete restrict,
  author_id uuid references auth.users(id) on delete set null,
  author_display_name text not null check (length(trim(author_display_name)) between 2 and 80),
  featured_image_url text check (featured_image_url is null or featured_image_url ~ '^https://'),
  featured_image_alt text check (featured_image_alt is null or length(featured_image_alt) <= 200),
  seo_title text check (seo_title is null or length(seo_title) <= 70),
  seo_description text check (seo_description is null or length(seo_description) <= 170),
  canonical_path text check (canonical_path is null or canonical_path like '/journal/%'),
  related_location_id uuid references public.location_nodes(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','in_review','scheduled','published','unpublished')),
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_for is not null),
  -- No thin pages: published articles need real body text and an SEO description.
  check (status <> 'published' or (published_at is not null and char_length(body_markdown) >= 500
         and nullif(trim(coalesce(seo_description, '')), '') is not null and featured_image_alt is not null))
);
create table if not exists public.blog_article_properties (
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  display_order integer not null default 0,
  primary key (article_id, property_id)
);
create index if not exists blog_articles_public_idx on public.blog_articles(published_at desc) where status = 'published';
create index if not exists blog_articles_category_idx on public.blog_articles(category_id, published_at desc);
create index if not exists blog_articles_author_idx on public.blog_articles(author_id) where author_id is not null;
create index if not exists blog_articles_location_idx on public.blog_articles(related_location_id) where related_location_id is not null;
create index if not exists blog_article_properties_property_idx on public.blog_article_properties(property_id);
create trigger blog_categories_touch before update on public.blog_categories for each row execute function public.set_updated_at();
create trigger blog_articles_touch before update on public.blog_articles for each row execute function public.set_updated_at();

alter table public.blog_categories enable row level security;
alter table public.blog_articles enable row level security;
alter table public.blog_article_properties enable row level security;
revoke all on public.blog_categories, public.blog_articles, public.blog_article_properties from anon, authenticated;
grant select on public.blog_categories, public.blog_articles, public.blog_article_properties to anon, authenticated;
grant insert, update, delete on public.blog_categories, public.blog_articles, public.blog_article_properties to authenticated;
grant all on public.blog_categories, public.blog_articles, public.blog_article_properties to service_role;
create policy "Public reads active categories" on public.blog_categories for select to anon, authenticated using (is_active or public.has_staff_permission('content.manage'));
create policy "Staff manage journal categories" on public.blog_categories for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));
create policy "Public reads published articles" on public.blog_articles for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or public.has_staff_permission('content.manage'));
create policy "Staff manage articles" on public.blog_articles for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));
create policy "Public reads links of published articles" on public.blog_article_properties for select to anon, authenticated
  using (public.has_staff_permission('content.manage') or (
    exists (select 1 from public.blog_articles a where a.id = article_id and a.status = 'published' and a.published_at <= now())
    and exists (select 1 from public.properties p where p.id = property_id and p.approval_status = 'approved' and p.is_active)));
create policy "Staff manage article property links" on public.blog_article_properties for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));

-- ---------------------------------------------------------------------------
-- 5. AI listing drafts. Generated text stays a draft until the provider reviews it (Prompt 11 rule).
--    Existing ai_listing_sessions.suggestions JSON is NOT migrated: its shape is not guaranteed.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_listing_drafts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_listing_sessions(id) on delete cascade,
  organisation_id uuid not null references public.provider_organisations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,50}$'),
  content text not null check (length(content) between 1 and 6000),
  status text not null default 'draft' check (status in ('draft','accepted','edited_accepted','rejected')),
  model text check (model is null or length(model) <= 80),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'draft' or (reviewed_by is not null and reviewed_at is not null))
);
create index if not exists ai_listing_drafts_session_idx on public.ai_listing_drafts(session_id, created_at);
create index if not exists ai_listing_drafts_org_idx on public.ai_listing_drafts(organisation_id, created_at desc);
create index if not exists ai_listing_drafts_property_idx on public.ai_listing_drafts(property_id) where property_id is not null;
create index if not exists ai_listing_drafts_created_by_idx on public.ai_listing_drafts(created_by) where created_by is not null;
create index if not exists ai_listing_drafts_reviewed_by_idx on public.ai_listing_drafts(reviewed_by) where reviewed_by is not null;

alter table public.ai_listing_drafts enable row level security;
revoke all on public.ai_listing_drafts from anon, authenticated;
grant select, insert on public.ai_listing_drafts to authenticated;
grant update (content, status, reviewed_by, reviewed_at) on public.ai_listing_drafts to authenticated;
grant all on public.ai_listing_drafts to service_role;
create policy "Session owners read drafts" on public.ai_listing_drafts for select to authenticated using (
  exists (select 1 from public.ai_listing_sessions s where s.id = session_id and s.created_by = auth.uid() and public.is_provider_member(s.organisation_id))
  or public.is_administrator());
create policy "Session owners create drafts" on public.ai_listing_drafts for insert to authenticated with check (
  status = 'draft' and created_by = auth.uid()
  and exists (select 1 from public.ai_listing_sessions s where s.id = session_id and s.organisation_id = ai_listing_drafts.organisation_id
              and s.created_by = auth.uid() and public.is_provider_member(s.organisation_id)));
create policy "Session owners review drafts" on public.ai_listing_drafts for update to authenticated
  using (exists (select 1 from public.ai_listing_sessions s where s.id = session_id and s.created_by = auth.uid() and public.is_provider_member(s.organisation_id)))
  with check ((status = 'draft' or reviewed_by = auth.uid())
              and exists (select 1 from public.ai_listing_sessions s where s.id = session_id and s.created_by = auth.uid() and public.is_provider_member(s.organisation_id)));

-- ---------------------------------------------------------------------------
-- 6. Analytics events. Written ONLY by trusted server code (service_role) after bot filtering, so that
--    promotion performance reports cannot be inflated by anonymous callers. No raw IP addresses are stored.
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.]{2,63}$'),
  property_id uuid references public.properties(id) on delete set null,
  location_id uuid references public.location_nodes(id) on delete set null,
  promotion_id uuid references public.promotions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  session_hash text check (session_hash is null or length(session_hash) <= 128),   -- rotating keyed hash, not an identifier
  referrer_host text check (referrer_host is null or length(referrer_host) <= 120),
  device_class text check (device_class is null or device_class in ('mobile','tablet','desktop','bot','unknown')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2048)
);
create index if not exists analytics_events_time_brin on public.analytics_events using brin (occurred_at);
create index if not exists analytics_events_property_idx on public.analytics_events(property_id, occurred_at desc) where property_id is not null;
create index if not exists analytics_events_type_idx on public.analytics_events(event_type, occurred_at desc);
create index if not exists analytics_events_location_idx on public.analytics_events(location_id, occurred_at desc) where location_id is not null;
create index if not exists analytics_events_promotion_idx on public.analytics_events(promotion_id, occurred_at desc) where promotion_id is not null;
create index if not exists analytics_events_user_idx on public.analytics_events(user_id) where user_id is not null;

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;
create policy "Report viewers read analytics events" on public.analytics_events
  for select to authenticated using (public.has_staff_permission('reports.view'));

-- ---------------------------------------------------------------------------
-- 7. Data retention policy register. Every row is DISABLED and the intervals are PROPOSALS pending
--    legal/accounting confirmation. data_retention_preview() only counts; it never deletes.
-- ---------------------------------------------------------------------------
create table if not exists public.data_retention_policies (
  table_name text primary key check (table_name ~ '^[a-z][a-z0-9_]{1,62}$'),
  timestamp_column text not null check (timestamp_column ~ '^[a-z][a-z0-9_]{1,62}$'),
  retention_interval interval not null check (retention_interval > interval '0'),
  action text not null check (action in ('delete','anonymise','retain')),
  rationale text not null,
  is_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists data_retention_policies_updated_by_idx on public.data_retention_policies(updated_by) where updated_by is not null;
create trigger data_retention_policies_audit after insert or update or delete on public.data_retention_policies for each row execute function public.audit_row_change();
create trigger data_retention_policies_touch before update on public.data_retention_policies for each row execute function public.set_updated_at();

insert into public.data_retention_policies (table_name, timestamp_column, retention_interval, action, rationale) values
  ('analytics_events','occurred_at', interval '13 months','delete','Proposal: enough for year-on-year comparison; no personal identifiers stored.'),
  ('notifications','created_at', interval '12 months','delete','Proposal: in-app notices have no lasting value.'),
  ('recently_viewed','viewed_at', interval '90 days','delete','Proposal: convenience feature.'),
  ('property_enquiries','created_at', interval '24 months','anonymise','Proposal: keep counts, remove sender name/contact/message. Confirm against Nigeria Data Protection Act guidance.'),
  ('support_tickets','created_at', interval '36 months','anonymise','Proposal: anonymise requester details after the dispute window.'),
  ('webhook_events','received_at', interval '12 months','anonymise','Proposal: redact payload after reconciliation window; keep dedupe key.'),
  ('ai_listing_events','created_at', interval '24 months','delete','Proposal: usage audit window.'),
  ('newsletter_subscribers','unsubscribed_at', interval '24 months','delete','Proposal: keep a suppression record only as long as needed to honour unsubscribes.'),
  ('subscription_payments','created_at', interval '7 years','retain','Financial records. Retention period MUST be confirmed with an accountant; never auto-delete.'),
  ('invoices','created_at', interval '7 years','retain','Tax records. Retention period MUST be confirmed with an accountant; never auto-delete.'),
  ('admin_audit_logs','created_at', interval '7 years','retain','Append-only. Archive by partition after approval; never row-delete.')
on conflict (table_name) do nothing;

create or replace function public.data_retention_preview()
returns table (policy_table text, policy_action text, retention interval, enabled boolean, rows_past_retention bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n bigint;
begin
  if not public.is_administrator() then raise exception 'Administrator access required'; end if;
  for r in select * from public.data_retention_policies p order by p.table_name loop
    execute format('select count(*) from public.%I where %I < now() - $1', r.table_name, r.timestamp_column) into n using r.retention_interval;
    policy_table := r.table_name; policy_action := r.action; retention := r.retention_interval; enabled := r.is_enabled; rows_past_retention := n;
    return next;
  end loop;
end;
$$;
revoke all on function public.data_retention_preview() from public, anon;
grant execute on function public.data_retention_preview() to authenticated;

alter table public.data_retention_policies enable row level security;
revoke all on public.data_retention_policies from anon, authenticated;
grant select on public.data_retention_policies to authenticated;
grant all on public.data_retention_policies to service_role;
create policy "Administrators read retention policies" on public.data_retention_policies for select to authenticated using (public.is_administrator());
