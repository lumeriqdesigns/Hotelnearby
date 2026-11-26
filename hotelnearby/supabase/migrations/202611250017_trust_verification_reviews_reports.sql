-- Trust, verification evidence, review moderation, listing reports and disputes.
-- Additive migration. Review verification is evidence-based; no booking confirmation is assumed.

create table if not exists public.trust_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('property','review','provider','verification')),
  property_id uuid references public.properties(id) on delete set null,
  review_id uuid references public.reviews(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('inaccurate_information','misleading_photos','suspected_fraud','impersonation','safety_concern','spam','harassment','review_integrity','other')),
  details text not null check (length(trim(details)) between 20 and 2000),
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_contact text check (reporter_contact is null or length(reporter_contact) <= 254),
  status text not null default 'open' check (status in ('open','investigating','action_required','resolved','dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or length(resolution_note) <= 2000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_type = 'review' and review_id is not null) or target_type <> 'review'),
  check (status not in ('resolved','dismissed') or (resolved_by is not null and resolved_at is not null and nullif(trim(coalesce(resolution_note,'')),'') is not null))
);
create index if not exists trust_reports_queue_idx on public.trust_reports(status, created_at desc);
create index if not exists trust_reports_property_idx on public.trust_reports(property_id, created_at desc);
create index if not exists trust_reports_review_idx on public.trust_reports(review_id) where review_id is not null;
create trigger trust_reports_touch before update on public.trust_reports for each row execute function public.set_updated_at();
create trigger trust_reports_audit after update or delete on public.trust_reports for each row execute function public.audit_row_change();
alter table public.trust_reports enable row level security;
revoke all on public.trust_reports from anon, authenticated;
grant select, insert, update on public.trust_reports to authenticated;
grant insert on public.trust_reports to anon;
grant all on public.trust_reports to service_role;
create policy "Visitors may submit a report" on public.trust_reports for insert to anon, authenticated
  with check (status = 'open' and assigned_to is null and resolution_note is null and resolved_by is null and resolved_at is null
    and (reporter_id is null or reporter_id = auth.uid())
    and (property_id is null or exists(select 1 from public.properties p where p.id = property_id))
    and (review_id is null or exists(select 1 from public.reviews r where r.id = review_id and r.status = 'published')));
create policy "Reporters see their own reports and moderators see queue" on public.trust_reports for select to authenticated
  using (reporter_id = auth.uid() or public.has_staff_permission('reports.view') or public.has_staff_permission('reviews.moderate') or public.has_staff_permission('verification.review'));
create policy "Moderators manage reports" on public.trust_reports for update to authenticated
  using (public.has_staff_permission('reports.view') or public.has_staff_permission('reviews.moderate') or public.has_staff_permission('verification.review'))
  with check (public.has_staff_permission('reports.view') or public.has_staff_permission('reviews.moderate') or public.has_staff_permission('verification.review'));

create table if not exists public.trust_disputes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  verification_record_id uuid references public.verification_records(id) on delete set null,
  review_id uuid references public.reviews(id) on delete set null,
  opened_by uuid references auth.users(id) on delete set null,
  subject text not null check (length(trim(subject)) between 5 and 160),
  statement text not null check (length(trim(statement)) between 30 and 4000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  status text not null default 'open' check (status in ('open','under_review','awaiting_information','upheld','not_upheld','closed')),
  reviewer_id uuid references auth.users(id) on delete set null,
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (property_id is not null or verification_record_id is not null or review_id is not null),
  check (status not in ('upheld','not_upheld','closed') or (reviewer_id is not null and decided_at is not null and nullif(trim(coalesce(decision_note,'')),'') is not null))
);
create index if not exists trust_disputes_queue_idx on public.trust_disputes(status, created_at desc);
create index if not exists trust_disputes_property_idx on public.trust_disputes(property_id, created_at desc);
create trigger trust_disputes_touch before update on public.trust_disputes for each row execute function public.set_updated_at();
create trigger trust_disputes_audit after update or delete on public.trust_disputes for each row execute function public.audit_row_change();
alter table public.trust_disputes enable row level security;
revoke all on public.trust_disputes from anon, authenticated;
grant select, insert, update on public.trust_disputes to authenticated;
grant all on public.trust_disputes to service_role;
create policy "Provider members open property disputes" on public.trust_disputes for insert to authenticated
  with check (opened_by = auth.uid() and status = 'open' and reviewer_id is null and decided_at is null
    and (property_id is null or public.can_manage_property(property_id)));
create policy "Disputants and moderators read disputes" on public.trust_disputes for select to authenticated
  using (opened_by = auth.uid() or (property_id is not null and public.can_manage_property(property_id)) or public.has_staff_permission('verification.review') or public.has_staff_permission('reviews.moderate'));
create policy "Moderators decide disputes" on public.trust_disputes for update to authenticated
  using (public.has_staff_permission('verification.review') or public.has_staff_permission('reviews.moderate'))
  with check (public.has_staff_permission('verification.review') or public.has_staff_permission('reviews.moderate'));

-- Immutable event trail for all trust decisions, including inserts (the generic row audit trigger records updates/deletes).
create table if not exists public.trust_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('verification','review','report','dispute','property')),
  entity_id uuid not null,
  action text not null check (length(action) between 2 and 80),
  reason text check (reason is null or length(reason) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists trust_audit_events_entity_idx on public.trust_audit_events(entity_type, entity_id, created_at desc);
create index if not exists trust_audit_events_actor_idx on public.trust_audit_events(actor_id, created_at desc);
alter table public.trust_audit_events enable row level security;
revoke all on public.trust_audit_events from anon, authenticated;
grant select, insert on public.trust_audit_events to authenticated;
grant all on public.trust_audit_events to service_role;
create policy "Trust moderators read audit trail" on public.trust_audit_events for select to authenticated
  using (public.has_staff_permission('verification.review') or public.has_staff_permission('reviews.moderate') or public.has_staff_permission('reports.view'));
create policy "Authenticated actors append trust audit trail" on public.trust_audit_events for insert to authenticated
  with check (actor_id = auth.uid() and (public.has_staff_permission('verification.review') or public.has_staff_permission('reviews.moderate') or public.has_staff_permission('reports.view')));

-- Review inserts (including the initial pending submission) must be auditable.
create or replace function public.audit_review_insert() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.trust_audit_events(actor_id,entity_type,entity_id,action,metadata)
  values(new.user_id,'review',new.id,'submitted',jsonb_build_object('property_id',new.property_id,'evidence_level',new.evidence_level,'status',new.status));
  return new;
end; $$;
create trigger reviews_insert_trust_audit after insert on public.reviews for each row execute function public.audit_review_insert();

comment on table public.trust_reports is 'User-submitted listing, provider and review integrity reports; no automatic enforcement.';
comment on table public.trust_disputes is 'Human-reviewed disputes related to properties, verification records and reviews.';
comment on table public.trust_audit_events is 'Append-only trust workflow decision trail. Never store raw identity documents in this table.';

create policy "Providers read published reviews for managed properties" on public.reviews for select to authenticated
  using (status = 'published' and public.can_manage_property(property_id));

-- Private evidence storage. Object keys use <property-uuid>/<opaque-filename>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('property-verification','property-verification',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create policy "Providers upload verification evidence to own property folder" on storage.objects for insert to authenticated
  with check (bucket_id='property-verification' and public.can_manage_property((storage.foldername(name))[1]::uuid));
create policy "Providers and verification reviewers read private evidence" on storage.objects for select to authenticated
  using (bucket_id='property-verification' and (public.can_manage_property((storage.foldername(name))[1]::uuid) or public.has_staff_permission('verification.review')));
create policy "Providers may remove own unsubmitted evidence objects" on storage.objects for delete to authenticated
  using (bucket_id='property-verification' and public.can_manage_property((storage.foldername(name))[1]::uuid));
create policy "Trust moderators read properties for case review" on public.properties for select to authenticated
  using (public.has_staff_permission('verification.review') or public.has_staff_permission('reviews.moderate') or public.has_staff_permission('reports.view'));

create or replace function public.admin_decide_verification_record(
  p_record_id uuid, p_property_id uuid, p_status text, p_note text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_property_id uuid; v_property_status text; v_now timestamptz := now();
begin
  if public.current_platform_role() is distinct from 'administrator' then raise exception 'Administrator access required'; end if;
  if p_status not in ('in_review','verified','rejected','expired','revoked') or length(trim(coalesce(p_note,''))) < 5 then raise exception 'A decision status and reason are required'; end if;
  select property_id into v_property_id from public.verification_records where id=p_record_id and property_id=p_property_id for update;
  if v_property_id is null then return false; end if;
  update public.verification_records set status=p_status,
    reviewed_by=case when p_status in ('verified','rejected','revoked') then auth.uid() else null end,
    reviewed_at=case when p_status in ('verified','rejected','revoked') then v_now else null end,
    decision_note=left(trim(p_note),2000), valid_from=case when p_status='verified' then v_now else null end
  where id=p_record_id;
  v_property_status := case when p_status='verified' then 'verified' when p_status='rejected' then 'rejected' when p_status='in_review' then 'pending' else 'unverified' end;
  update public.properties set verification_status=v_property_status,
    verification_note=left(trim(p_note),2000), verification_reviewed_by=auth.uid(), verification_reviewed_at=v_now, updated_at=v_now
  where id=v_property_id;
  insert into public.trust_audit_events(actor_id,entity_type,entity_id,action,reason,metadata)
  values(auth.uid(),'verification',p_record_id,p_status,left(trim(p_note),2000),jsonb_build_object('property_id',v_property_id,'property_status',v_property_status));
  return true;
end; $$;
revoke all on function public.admin_decide_verification_record(uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_decide_verification_record(uuid,uuid,text,text) to authenticated;
drop trigger if exists trust_reports_audit on public.trust_reports;
create trigger trust_reports_audit after insert or update or delete on public.trust_reports for each row execute function public.audit_row_change();
drop trigger if exists trust_disputes_audit on public.trust_disputes;
create trigger trust_disputes_audit after insert or update or delete on public.trust_disputes for each row execute function public.audit_row_change();

alter table public.trust_reports drop constraint if exists trust_reports_target_reference_check;
alter table public.trust_reports add constraint trust_reports_target_reference_check check (
  (target_type <> 'property' or property_id is not null)
  and (target_type <> 'review' or review_id is not null)
  and (target_type <> 'provider' or reported_user_id is not null)
  and (target_type <> 'verification' or property_id is not null or reported_user_id is not null)
);
drop policy if exists "Provider members open property disputes" on public.trust_disputes;
create policy "Provider members open property disputes" on public.trust_disputes for insert to authenticated
  with check (opened_by = auth.uid() and status = 'open' and reviewer_id is null and decided_at is null
    and property_id is not null and public.can_manage_property(property_id)
    and (verification_record_id is null or exists(select 1 from public.verification_records v where v.id=verification_record_id and v.property_id=property_id))
    and (review_id is null or exists(select 1 from public.reviews r where r.id=review_id and r.property_id=property_id)));
