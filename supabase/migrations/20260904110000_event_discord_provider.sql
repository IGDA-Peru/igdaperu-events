alter table public.events
  drop constraint if exists events_meeting_provider_valid;

alter table public.events
  add constraint events_meeting_provider_valid
  check (meeting_provider in ('google_meet', 'zoom', 'discord', 'other'));
