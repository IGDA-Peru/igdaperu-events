-- Primera carga: los eventos públicos existentes se sincronizan por la cola,
-- sin depender de esperar al primer Cron nocturno.
insert into public.google_calendar_sync_jobs (
  event_id,
  calendar_event_id,
  operation,
  status,
  run_after,
  locked_at,
  last_error
)
select
  event.id,
  public.google_calendar_event_id(event.id),
  'sync',
  'pending',
  now(),
  null,
  null
from public.events event
join public.communities community on community.id = event.community_id
where event.status = 'published'
  and event.visibility = 'public'
  and community.status = 'approved'
  and event.starts_at is not null
  and event.ends_at is not null
on conflict (calendar_event_id) do update set
  event_id = excluded.event_id,
  operation = 'sync',
  status = 'pending',
  run_after = now(),
  locked_at = null,
  last_error = null,
  updated_at = now();
