alter table public.events
  alter column description drop not null,
  alter column starts_at drop not null,
  alter column ends_at drop not null,
  add column if not exists place_id text,
  add column if not exists formatted_address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.events
  drop constraint if exists events_time_order,
  drop constraint if exists events_online_link,
  drop constraint if exists events_publish_completeness,
  drop constraint if exists events_latitude_range,
  drop constraint if exists events_longitude_range;

alter table public.events
  add constraint events_time_order
  check (
    starts_at is null
    or ends_at is null
    or ends_at > starts_at
  ),
  add constraint events_online_link
  check (
    status = 'draft'
    or location_type = 'venue'
    or meeting_url is not null
  ),
  add constraint events_publish_completeness
  check (
    status = 'draft'
    or (
      description is not null
      and char_length(description) between 3 and 5000
      and starts_at is not null
      and ends_at is not null
      and (
        location_type = 'venue'
        or meeting_url is not null
      )
      and (
        location_type = 'online'
        or nullif(trim(venue_name), '') is not null
        or nullif(trim(address), '') is not null
        or (latitude is not null and longitude is not null)
      )
    )
  ),
  add constraint events_latitude_range
  check (latitude is null or latitude between -90 and 90),
  add constraint events_longitude_range
  check (longitude is null or longitude between -180 and 180);

create index if not exists events_place_id_idx
  on public.events (place_id)
  where place_id is not null;

drop policy if exists events_manager_delete on public.events;
create policy events_manager_delete on public.events
  for delete to authenticated
  using (
    ((status = 'draft' and ends_at is null) or ends_at > now())
    and public.has_community_role(community_id, array['community_admin']::public.app_role[])
);

drop policy if exists events_platform_delete on public.events;
create policy events_platform_delete on public.events
  for delete to authenticated
  using (
    ((status = 'draft' and ends_at is null) or ends_at > now())
    and public.is_platform_admin()
);
