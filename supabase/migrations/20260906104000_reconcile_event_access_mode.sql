-- La migración de privacidad ya estaba registrada en algunos proyectos antes
-- de incluir access_mode. Reconciliamos el esquema sin editar una migración
-- histórica que puede haber sido aplicada en producción.
alter table public.events
  add column if not exists access_mode text not null default 'location_access';

alter table public.events
  drop constraint if exists events_access_mode_valid;

alter table public.events
  add constraint events_access_mode_valid
  check (access_mode in ('registration_only', 'location_access'));
