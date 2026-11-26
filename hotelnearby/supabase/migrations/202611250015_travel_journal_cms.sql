-- Travel Journal CMS extensions: taxonomy, multiple destination links and editorial links.
-- Canonical may be an internal journal path or a deliberate HTTPS canonical URL.
alter table public.blog_articles drop constraint if exists blog_articles_canonical_path_check;
alter table public.blog_articles add constraint blog_articles_canonical_path_check
  check (canonical_path is null or canonical_path like '/journal/%' or canonical_path ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/|$)');
create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) between 2 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.blog_article_tags (
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (article_id, tag_id)
);

create table if not exists public.blog_article_destinations (
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  destination_id uuid not null references public.location_nodes(id) on delete cascade,
  display_order integer not null default 0,
  primary key (article_id, destination_id)
);

create table if not exists public.blog_article_links (
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  linked_article_id uuid not null references public.blog_articles(id) on delete cascade,
  link_label text not null check (length(trim(link_label)) between 2 and 100),
  display_order integer not null default 0,
  primary key (article_id, linked_article_id),
  check (article_id <> linked_article_id)
);

create index if not exists blog_tags_slug_idx on public.blog_tags(slug);
create index if not exists blog_article_tags_tag_idx on public.blog_article_tags(tag_id);
create index if not exists blog_article_destinations_destination_idx on public.blog_article_destinations(destination_id);
create index if not exists blog_article_links_linked_idx on public.blog_article_links(linked_article_id);

alter table public.blog_tags enable row level security;
alter table public.blog_article_tags enable row level security;
alter table public.blog_article_destinations enable row level security;
alter table public.blog_article_links enable row level security;
revoke all on public.blog_tags, public.blog_article_tags, public.blog_article_destinations, public.blog_article_links from anon, authenticated;
grant select on public.blog_tags, public.blog_article_tags, public.blog_article_destinations, public.blog_article_links to anon, authenticated;
grant insert, update, delete on public.blog_tags, public.blog_article_tags, public.blog_article_destinations, public.blog_article_links to authenticated;
grant all on public.blog_tags, public.blog_article_tags, public.blog_article_destinations, public.blog_article_links to service_role;

create policy "Public reads tags used by published articles" on public.blog_tags for select to anon, authenticated
  using (exists (select 1 from public.blog_article_tags atg join public.blog_articles a on a.id = atg.article_id where atg.tag_id = id and a.status = 'published' and a.published_at <= now()) or public.has_staff_permission('content.manage'));
create policy "Staff manage tags" on public.blog_tags for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));
create policy "Public reads published article tags" on public.blog_article_tags for select to anon, authenticated
  using (exists (select 1 from public.blog_articles a where a.id = article_id and a.status = 'published' and a.published_at <= now()) or public.has_staff_permission('content.manage'));
create policy "Staff manage article tags" on public.blog_article_tags for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));
create policy "Public reads published article destinations" on public.blog_article_destinations for select to anon, authenticated
  using (exists (select 1 from public.blog_articles a where a.id = article_id and a.status = 'published' and a.published_at <= now()) or public.has_staff_permission('content.manage'));
create policy "Staff manage article destinations" on public.blog_article_destinations for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));
create policy "Public reads published article links" on public.blog_article_links for select to anon, authenticated
  using (exists (select 1 from public.blog_articles a where a.id = article_id and a.status = 'published' and a.published_at <= now()) and exists (select 1 from public.blog_articles target where target.id = linked_article_id and target.status = 'published' and target.published_at <= now()) or public.has_staff_permission('content.manage'));
create policy "Staff manage article links" on public.blog_article_links for all to authenticated
  using (public.has_staff_permission('content.manage')) with check (public.has_staff_permission('content.manage'));

insert into public.blog_categories (slug, name, description, display_order) values
 ('destination-guides','Destination guides','Practical, locally informed guides to places worth exploring.',1),
 ('travel-tips','Travel tips','Useful planning, transport, safety and travel preparation advice.',2),
 ('accommodation-guides','Accommodation guides','How to choose hotels, apartments, shortlets and other stays.',3),
 ('local-experiences','Local experiences','Activities, attractions and experiences grounded in local knowledge.',4),
 ('food-restaurants','Food & restaurants','Local food culture, dining guides and restaurant recommendations.',5),
 ('events-festivals','Events & festivals','Verified event, festival and seasonal visitor information.',6),
 ('tourism-culture','Tourism & culture','Heritage, traditions, arts and responsible tourism.',7),
 ('budget-travel','Budget travel','Practical ways to plan trips and manage travel costs.',8),
 ('family-travel','Family travel','Family-friendly destinations, stays and activities.',9),
 ('business-travel','Business travel','Work-trip planning, convenient stays and business visitor guides.',10)
on conflict (slug) do update set name = excluded.name, description = excluded.description, display_order = excluded.display_order;

comment on table public.blog_articles is 'Human-reviewed Hotelnearby Travel Journal articles. AI-assisted drafts must remain drafts until editorial review.';

-- Publicly readable editorial images; uploads are restricted to content staff.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal-images', 'journal-images', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;
create policy "Public reads journal images" on storage.objects for select to anon, authenticated using (bucket_id = 'journal-images');
create policy "Content staff upload journal images" on storage.objects for insert to authenticated with check (bucket_id = 'journal-images' and public.has_staff_permission('content.manage') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Content staff delete own journal images" on storage.objects for delete to authenticated using (bucket_id = 'journal-images' and public.has_staff_permission('content.manage') and (storage.foldername(name))[1] = auth.uid()::text);
