-- Prompt 15: paid promotional placement workflow.
-- Apply only after migrations 001-013 have been reviewed and applied to a development database.
-- This migration does not add booking, reservation, guest payment or provider payout functionality.

-- Pending paid requests retain their requested start/end dates but do not reserve a slot until approval.
comment on column public.promotions.inventory_id is 'Exclusive promotional inventory slot allocated by an administrator after payment verification.';
comment on column public.promotions.starts_at is 'Provider requested start while awaiting approval; administrator-approved schedule after approval.';
comment on column public.promotions.ends_at is 'Calculated from the administrator-approved start and purchased duration.';

-- Guard approved placements at database level as well as in the administrator API.
create or replace function public.guard_promotion_approval()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare slot public.promotional_inventory%rowtype;
        property_category text;
        property_city uuid;
        property_approval_status text;
        property_is_active boolean;
begin
  if new.inventory_id is not null and new.status in ('awaiting_payment','paid','pending_approval','approved','scheduled','active') then
    select * into slot from public.promotional_inventory where id = new.inventory_id and is_active;
    if not found or slot.slot_type <> new.promotion_type or slot.target_location_id is distinct from new.target_location_id or slot.target_category_slug is distinct from new.target_category_slug then
      raise exception 'Promotional inventory does not match the promotion target or is inactive';
    end if;
  end if;
  if new.status in ('approved','scheduled','active') then
    if not exists (select 1 from public.subscription_payments p where p.promotion_id = new.id and p.purpose = 'promotion' and p.status = 'succeeded') then
      raise exception 'A verified promotional payment is required';
    end if;
    if new.inventory_id is null or new.approved_by is null or new.approved_at is null or new.starts_at is null or new.ends_at is null then
      raise exception 'An approved promotion requires inventory, approver and scheduled dates';
    end if;
    if new.ends_at <= new.starts_at then raise exception 'Promotion end must be after start'; end if;
    select category, city_location_id, approval_status, is_active into property_category, property_city, property_approval_status, property_is_active from public.properties where id = new.property_id;
    if property_approval_status <> 'approved' or property_is_active is distinct from true then
      raise exception 'Only active administrator-approved properties can be promoted';
    end if;
    if new.promotion_type = 'city' and new.target_location_id is distinct from property_city then
      raise exception 'City promotion must target the property city';
    end if;
    if new.promotion_type = 'category' and new.target_category_slug is distinct from property_category then
      raise exception 'Category promotion must match the property category';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists promotions_approval_guard on public.promotions;
create trigger promotions_approval_guard before insert or update of status, inventory_id, starts_at, ends_at, approved_by, approved_at on public.promotions
for each row execute function public.guard_promotion_approval();

-- Reporting indexes support provider/admin performance summaries.
create index if not exists analytics_promotion_impressions_idx on public.analytics_events(promotion_id, occurred_at desc) where promotion_id is not null and event_type = 'promotion.impression';
create index if not exists analytics_promotion_clicks_idx on public.analytics_events(promotion_id, occurred_at desc) where promotion_id is not null and event_type = 'promotion.click';

-- Public users cannot write analytics directly. Trusted server-side event logging uses service_role.
revoke insert, update, delete on public.analytics_events from anon, authenticated;
grant all on public.analytics_events to service_role;

comment on table public.promotional_inventory is 'Administrator-managed exclusive paid placement slots. Paid promotions are separate from organic search ranking.';
comment on table public.promotions is 'Provider-paid promotional placements; payment does not guarantee views, enquiries, ranking or accommodation reservations.';

-- Public, read-only projection for approved live placements. The browser never receives billing data.
create or replace function public.get_live_promotional_placements(
  p_types text[] default array['featured','homepage']::text[],
  p_city_slug text default null,
  p_category_slug text default null,
  p_limit integer default 8
)
returns table (
  promotion_id uuid,
  promotion_type text,
  property_id uuid,
  property_name text,
  property_slug text,
  property_category text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.id, pr.promotion_type, p.id, p.name, p.slug, p.category
  from public.promotions pr
  join public.properties p on p.id = pr.property_id
  join public.promotional_inventory pi on pi.id = pr.inventory_id and pi.is_active
  where pr.status in ('active','scheduled')
    and pr.starts_at <= now() and pr.ends_at > now()
    and p.approval_status = 'approved' and p.is_active
    and pr.promotion_type = any(p_types)
    and (p_city_slug is null or exists (select 1 from public.location_nodes l where l.id = pr.target_location_id and l.slug = p_city_slug and l.level = 'city_town'))
    and (p_category_slug is null or pr.target_category_slug = p_category_slug)
  order by pr.starts_at desc, pr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 24));
$$;
revoke all on function public.get_live_promotional_placements(text[],text,text,integer) from public;
grant execute on function public.get_live_promotional_placements(text[],text,text,integer) to anon, authenticated;

-- Aggregate reporting avoids transferring raw analytics rows and supports large event volumes.
create or replace function public.get_promotion_performance(p_promotion_ids uuid[])
returns table (promotion_id uuid, impressions bigint, clicks bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.id,
    count(a.id) filter (where a.event_type = 'promotion.impression')::bigint,
    count(a.id) filter (where a.event_type = 'promotion.click')::bigint
  from public.promotions pr
  left join public.analytics_events a on a.promotion_id = pr.id and a.event_type in ('promotion.impression','promotion.click')
  where pr.id = any(coalesce(p_promotion_ids, array[]::uuid[]))
    and (auth.role() = 'service_role' or public.is_administrator() or public.is_provider_owner(pr.organisation_id))
  group by pr.id;
$$;
revoke all on function public.get_promotion_performance(uuid[]) from public;
grant execute on function public.get_promotion_performance(uuid[]) to authenticated, service_role;
