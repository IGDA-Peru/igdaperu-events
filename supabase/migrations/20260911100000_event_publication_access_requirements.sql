-- La ubicación y el enlace de sesión pueden mantenerse privados, pero esa
-- decisión debe ser explícita antes de publicar un evento con acceso habilitado.
alter table public.events
  add column if not exists meeting_link_visibility text not null default 'shared';

-- Los eventos existentes sin enlace se interpretan como una decisión previa
-- de no compartirlo para que la nueva columna no cambie su representación.
update public.events
set meeting_link_visibility = 'none'
where meeting_url is null
  and meeting_link_visibility = 'shared';

alter table public.events
  drop constraint if exists events_meeting_link_visibility_valid,
  drop constraint if exists events_general_location_complete,
  drop constraint if exists events_exact_location_complete,
  drop constraint if exists events_online_link,
  drop constraint if exists events_publish_completeness;

alter table public.events
  add constraint events_meeting_link_visibility_valid
  check (meeting_link_visibility in ('shared', 'none')),
  add constraint events_general_location_complete
  check (
    status = 'draft'
    or location_precision = 'none'
    or location_precision = 'exact'
    or (
      nullif(trim(location_department), '') is not null
      and (location_precision = 'department' or nullif(trim(location_province), '') is not null)
    )
  ),
  add constraint events_exact_location_complete
  check (
    status = 'draft'
    or location_precision <> 'exact'
    or nullif(trim(venue_name), '') is not null
    or nullif(trim(address), '') is not null
    or (latitude is not null and longitude is not null)
  ),
  add constraint events_online_link
  check (
    status = 'draft'
    or location_type = 'venue'
    or meeting_link_visibility = 'none'
    or meeting_url is not null
  ) not valid,
  add constraint events_publish_completeness
  check (
    status = 'draft'
    or (
      starts_at is not null
      and ends_at is not null
      and description is not null
      and char_length(description) between 3 and 5000
      and (
        location_type = 'online'
        or location_precision = 'none'
        or nullif(trim(location_department), '') is not null
        or nullif(trim(location_province), '') is not null
        or nullif(trim(venue_name), '') is not null
        or nullif(trim(address), '') is not null
        or (latitude is not null and longitude is not null)
      )
      and (
        location_type = 'venue'
        or meeting_link_visibility = 'none'
        or meeting_url is not null
      )
    )
  ) not valid;
