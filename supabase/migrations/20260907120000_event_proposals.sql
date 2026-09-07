-- Public event proposals are intentionally separated from events. Anonymous
-- visitors may submit a proposal through the Edge Function, but only platform
-- administrators can inspect or convert it into a published event.
create type public.event_proposal_status as enum ('pending', 'approved', 'rejected');

alter table public.events
  alter column community_id drop not null,
  add column if not exists organizer_name text;

alter table public.events
  drop constraint if exists events_organizer_name_length;

alter table public.events
  add constraint events_organizer_name_length
  check (organizer_name is null or char_length(organizer_name) between 2 and 160);

create table public.event_proposals (
  id uuid primary key default gen_random_uuid(),
  organizer_name text not null check (char_length(organizer_name) between 2 and 160),
  contact_email text not null check (char_length(contact_email) between 5 and 254 and position('@' in contact_email) > 1),
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 3 and 5000),
  type text not null default 'CHARLA' check (char_length(type) between 2 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  timezone text not null default 'America/Lima',
  location_type public.location_type not null default 'venue',
  access_mode text not null default 'registration_only',
  location_precision text not null default 'none',
  location_department text,
  location_province text,
  venue_name text,
  address text,
  map_url text,
  place_id text,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  meeting_url text,
  meeting_provider text not null default 'other',
  registration_url text,
  community_id uuid references public.communities(id) on delete set null,
  status public.event_proposal_status not null default 'pending',
  review_notes text not null default '' check (char_length(review_notes) <= 2000),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 5 and 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_proposals_time_order check (ends_at > starts_at),
  constraint event_proposals_access_mode_valid check (access_mode in ('registration_only', 'location_access')),
  constraint event_proposals_location_precision_valid check (location_precision in ('none', 'department', 'province', 'exact')),
  constraint event_proposals_meeting_provider_valid check (meeting_provider in ('google_meet', 'zoom', 'discord', 'other')),
  constraint event_proposals_registration_url_format check (registration_url is null or registration_url ~* '^https?://'),
  constraint event_proposals_meeting_url_format check (meeting_url is null or meeting_url ~* '^https?://'),
  constraint event_proposals_map_url_format check (map_url is null or map_url ~* '^https?://')
);

create index event_proposals_status_created_idx on public.event_proposals (status, created_at desc);
create index event_proposals_community_idx on public.event_proposals (community_id, created_at desc);
create unique index event_proposals_approved_event_unique on public.event_proposals (approved_event_id) where approved_event_id is not null;

create trigger event_proposals_set_updated_at
before update on public.event_proposals
for each row execute function public.set_updated_at();

alter table public.event_proposals enable row level security;

revoke all on public.event_proposals from anon;
grant select, update, delete on public.event_proposals to authenticated;

create policy event_proposals_platform_read
  on public.event_proposals for select to authenticated
  using (public.is_platform_admin());

create policy event_proposals_platform_update
  on public.event_proposals for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy event_proposals_platform_delete
  on public.event_proposals for delete to authenticated
  using (public.is_platform_admin());

-- Public events may be independent of a community. Community-scoped events
-- retain the existing approved-community requirement.
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select to anon
  using (
    visibility = 'public'
    and (
      status = 'published'
      or (status = 'archived' and ends_at <= now())
    )
    and (
      community_id is null
      or exists (
        select 1 from public.communities c
        where c.id = community_id and c.status = 'approved'
      )
    )
  );

drop policy if exists events_authenticated_read on public.events;
create policy events_authenticated_read on public.events
  for select to authenticated
  using (
    public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
    or (
      visibility in ('public', 'network')
      and (
        status = 'published'
        or (status = 'archived' and ends_at <= now())
      )
      and (
        community_id is null
        or exists (
          select 1 from public.communities c
          where c.id = community_id and c.status = 'approved'
        )
      )
    )
    or public.is_platform_admin()
  );

create or replace function public.approve_event_proposal(
  p_proposal_id uuid,
  p_community_id uuid default null,
  p_review_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposal_row public.event_proposals%rowtype;
  next_event_id uuid;
  base_slug text;
  next_slug text;
  suffix integer := 1;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can approve event proposals';
  end if;

  select * into proposal_row
    from public.event_proposals
   where id = p_proposal_id
   for update;

  if not found then raise exception 'Event proposal not found'; end if;
  if proposal_row.status <> 'pending' then raise exception 'Event proposal is no longer pending'; end if;

  if p_community_id is not null and not exists (
    select 1 from public.communities where id = p_community_id and status = 'approved'
  ) then
    raise exception 'The selected community is not approved';
  end if;

  base_slug := regexp_replace(lower(proposal_row.title), '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '(^-|-$)', '', 'g');
  if base_slug = '' then base_slug := 'evento'; end if;
  next_slug := base_slug;
  while exists (select 1 from public.events where slug = next_slug) loop
    suffix := suffix + 1;
    next_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.events (
    community_id, organizer_name, slug, title, description, type,
    starts_at, ends_at, is_all_day, timezone, location_type, access_mode,
    location_precision, location_department, location_province, venue_name,
    address, map_url, place_id, formatted_address, latitude, longitude,
    meeting_url, meeting_provider, registration_url, visibility, status,
    created_by, updated_by, published_at
  ) values (
    p_community_id, proposal_row.organizer_name, next_slug, proposal_row.title,
    proposal_row.description, proposal_row.type, proposal_row.starts_at,
    proposal_row.ends_at, proposal_row.is_all_day, proposal_row.timezone,
    proposal_row.location_type, proposal_row.access_mode,
    proposal_row.location_precision, proposal_row.location_department,
    proposal_row.location_province, proposal_row.venue_name, proposal_row.address,
    proposal_row.map_url, proposal_row.place_id, proposal_row.formatted_address,
    proposal_row.latitude, proposal_row.longitude, proposal_row.meeting_url,
    proposal_row.meeting_provider, proposal_row.registration_url, 'public',
    'published', (select auth.uid()), (select auth.uid()), now()
  ) returning id into next_event_id;

  update public.event_proposals
     set community_id = p_community_id,
         status = 'approved',
         review_notes = coalesce(p_review_notes, ''),
         reviewed_by = (select auth.uid()),
         reviewed_at = now(),
         approved_event_id = next_event_id
   where id = p_proposal_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'event_proposal.approved', 'event_proposal', p_proposal_id,
          jsonb_build_object('event_id', next_event_id, 'community_id', p_community_id));

  return next_event_id;
end;
$$;

grant execute on function public.approve_event_proposal(uuid, uuid, text) to authenticated;

create or replace function public.reject_event_proposal(
  p_proposal_id uuid,
  p_rejection_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can reject event proposals';
  end if;
  if char_length(trim(coalesce(p_rejection_reason, ''))) < 5 then
    raise exception 'A rejection reason is required';
  end if;

  update public.event_proposals
     set status = 'rejected',
         rejection_reason = trim(p_rejection_reason),
         reviewed_by = (select auth.uid()),
         reviewed_at = now()
   where id = p_proposal_id and status = 'pending';

  if not found then raise exception 'Event proposal is no longer pending'; end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'event_proposal.rejected', 'event_proposal', p_proposal_id, '{}'::jsonb);
end;
$$;

grant execute on function public.reject_event_proposal(uuid, text) to authenticated;
