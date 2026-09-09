-- Identidad visual configurable por cada comunidad.
alter table public.communities
  add column if not exists brand_color text;

alter table public.communities
  add constraint communities_brand_color_format
  check (brand_color is null or brand_color ~* '^#[0-9a-f]{6}$');

-- Una descripción de evento debe ser breve tanto en borradores como al publicar.
alter table public.events
  add constraint events_description_length
  check (description is null or char_length(description) <= 1000)
  not valid;

alter table public.events
  drop constraint if exists events_publish_completeness;

alter table public.events
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
          and char_length(description) between 3 and 1000
        )
      )
    )
  ) not valid;

-- Las propuestas públicas usan el mismo límite; NOT VALID evita bloquear la
-- migración si ya existe una propuesta antigua con más texto.
alter table public.event_proposals
  drop constraint if exists event_proposals_description_check;

alter table public.event_proposals
  add constraint event_proposals_description_length
  check (char_length(description) between 3 and 1000)
  not valid;
