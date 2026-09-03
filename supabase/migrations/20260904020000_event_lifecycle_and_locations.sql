alter table public.events
  add column if not exists map_url text,
  add column if not exists meeting_provider text not null default 'other';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_map_url_format'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_map_url_format
      check (map_url is null or map_url ~* '^https?://');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_meeting_provider_valid'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_meeting_provider_valid
      check (meeting_provider in ('zoom', 'google_meet', 'other'));
  end if;
end;
$$;

create index if not exists events_lifecycle_idx
  on public.events (ends_at, status);

create or replace function public.archive_expired_events()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  archived_count integer;
begin
  with changed as (
    update public.events
    set status = 'archived'
    where status = 'published'
      and ends_at <= now()
    returning id
  )
  select count(*) into archived_count from changed;

  return archived_count;
end;
$$;

revoke all on function public.archive_expired_events() from public, anon, authenticated;
grant execute on function public.archive_expired_events() to service_role;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select to anon
  using (
    visibility = 'public'
    and (
      status = 'published'
      or (status = 'archived' and ends_at <= now())
    )
    and exists (
      select 1
      from public.communities c
      where c.id = community_id
        and c.status = 'approved'
    )
  );

drop policy if exists events_network_read on public.events;
create policy events_network_read on public.events
  for select to authenticated
  using (
    visibility in ('public', 'network')
    and (
      status = 'published'
      or (status = 'archived' and ends_at <= now())
    )
    and exists (
      select 1
      from public.communities c
      where c.id = community_id
        and c.status = 'approved'
    )
  );

drop policy if exists events_manager_delete on public.events;
create policy events_manager_delete on public.events
  for delete to authenticated
  using (
    ends_at > now()
    and public.has_community_role(community_id, array['community_admin']::public.app_role[])
  );

drop policy if exists events_platform_manage on public.events;
create policy events_platform_insert on public.events
  for insert to authenticated
  with check (public.is_platform_admin());

create policy events_platform_update on public.events
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy events_platform_delete on public.events
  for delete to authenticated
  using (ends_at > now() and public.is_platform_admin());

-- If pg_cron is enabled in the project, keep the lifecycle job idempotent.
-- The migration remains valid when the extension has not been enabled yet.
do $$
begin
  if to_regnamespace('cron') is not null then
    execute $schedule$
      select cron.schedule(
        'archive-expired-events',
        '*/15 * * * *',
        'select public.archive_expired_events();'
      )
    $schedule$;
  end if;
end;
$$;
