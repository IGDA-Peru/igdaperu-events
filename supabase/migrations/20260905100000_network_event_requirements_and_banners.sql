-- Los eventos visibles solo para la red pueden publicarse con la información mínima.
-- Los eventos públicos mantienen la validación completa de contenido y acceso.
alter table public.events
  drop constraint if exists events_online_link,
  drop constraint if exists events_publish_completeness;

alter table public.events
  add constraint events_online_link
  check (
    status = 'draft'
    or visibility = 'network'
    or location_type = 'venue'
    or meeting_url is not null
  ),
  add constraint events_publish_completeness
  check (
    status = 'draft'
    or (
      starts_at is not null
      and ends_at is not null
      and (
        visibility = 'network'
        or (
          description is not null
          and char_length(description) between 3 and 5000
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
      )
    )
  );

create or replace function public.storage_event_id(path text)
returns uuid
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
begin
  return (split_part(path, '/', 1))::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', true)
on conflict (id) do nothing;

create policy event_assets_public_read on storage.objects
  for select
  using (bucket_id = 'event-assets');

create policy event_assets_manager_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-assets'
    and exists (
      select 1
        from public.events e
       where e.id = public.storage_event_id(name)
         and public.has_community_role(e.community_id, array['community_editor', 'community_admin']::public.app_role[])
    )
  );

create policy event_assets_manager_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-assets'
    and exists (
      select 1
        from public.events e
       where e.id = public.storage_event_id(name)
         and public.has_community_role(e.community_id, array['community_editor', 'community_admin']::public.app_role[])
    )
  );

create policy event_assets_manager_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-assets'
    and exists (
      select 1
        from public.events e
       where e.id = public.storage_event_id(name)
         and public.has_community_role(e.community_id, array['community_editor', 'community_admin']::public.app_role[])
    )
  );
