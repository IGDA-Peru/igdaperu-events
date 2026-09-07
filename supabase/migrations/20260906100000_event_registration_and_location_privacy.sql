-- Los enlaces de acceso y la ubicación publicada son decisiones de privacidad
-- de cada comunidad, no requisitos estructurales para publicar un evento.
alter table public.events
  add column if not exists registration_url text,
  add column if not exists access_mode text not null default 'location_access',
  add column if not exists location_precision text not null default 'none',
  add column if not exists location_department text,
  add column if not exists location_province text;

-- Los eventos anteriores que ya tenían dirección o coordenadas se consideran
-- ubicaciones exactas para conservar su representación pública actual.
update public.events
set location_precision = 'exact'
where location_precision = 'none'
  and (
    nullif(trim(venue_name), '') is not null
    or nullif(trim(address), '') is not null
    or nullif(trim(formatted_address), '') is not null
    or (latitude is not null and longitude is not null)
  );

alter table public.events
  drop constraint if exists events_registration_url_format,
  drop constraint if exists events_access_mode_valid,
  drop constraint if exists events_location_precision_valid,
  drop constraint if exists events_general_location_complete,
  drop constraint if exists events_exact_location_complete,
  drop constraint if exists events_online_link,
  drop constraint if exists events_publish_completeness;

alter table public.events
  add constraint events_registration_url_format
  check (registration_url is null or registration_url ~* '^https?://'),
  add constraint events_access_mode_valid
  check (access_mode in ('registration_only', 'location_access')),
  add constraint events_location_precision_valid
  check (location_precision in ('none', 'department', 'province', 'exact')),
  add constraint events_general_location_complete
  check (
    location_precision = 'none'
    or location_precision = 'exact'
    or (
      nullif(trim(location_department), '') is not null
      and (location_precision = 'department' or nullif(trim(location_province), '') is not null)
    )
  ),
  add constraint events_exact_location_complete
  check (
    location_precision <> 'exact'
    or nullif(trim(venue_name), '') is not null
    or nullif(trim(address), '') is not null
    or (latitude is not null and longitude is not null)
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
        )
      )
    )
  );

create index if not exists events_location_general_idx
  on public.events (location_department, location_province)
  where location_precision in ('department', 'province');
