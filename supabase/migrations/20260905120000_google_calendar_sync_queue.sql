-- Cola coalescida para sincronizar cambios de eventos con Google Calendar.
-- Un evento solo puede tener una tarea pendiente: varias ediciones seguidas
-- se convierten en una sola operación cuando el procesador la atiende.
create table if not exists public.google_calendar_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  calendar_event_id text not null,
  operation text not null check (operation in ('sync', 'delete')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_sync_jobs_calendar_event_unique unique (calendar_event_id)
);

create index if not exists google_calendar_sync_jobs_pending_idx
  on public.google_calendar_sync_jobs (status, run_after, created_at)
  where status in ('pending', 'failed');

create index if not exists google_calendar_sync_jobs_processing_idx
  on public.google_calendar_sync_jobs (locked_at)
  where status = 'processing';

alter table public.google_calendar_sync_jobs enable row level security;
revoke all on public.google_calendar_sync_jobs from public, anon, authenticated;
grant all on public.google_calendar_sync_jobs to service_role;

drop trigger if exists google_calendar_sync_jobs_set_updated_at on public.google_calendar_sync_jobs;
create trigger google_calendar_sync_jobs_set_updated_at
before update on public.google_calendar_sync_jobs
for each row execute function public.set_updated_at();

create or replace function public.google_calendar_event_id(source_id uuid)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select 'igdaperu' || replace(lower(source_id::text), '-', '');
$$;

create or replace function public.enqueue_google_calendar_sync_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_id uuid;
  next_operation text;
  next_event_id uuid;
begin
  if tg_op = 'DELETE' then
    source_id := old.id;
    next_operation := 'delete';
    next_event_id := null;
  elsif tg_op = 'INSERT' then
    source_id := new.id;
    next_operation := 'sync';
    next_event_id := new.id;
  elsif (
    old.community_id is distinct from new.community_id
    or old.slug is distinct from new.slug
    or old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.is_all_day is distinct from new.is_all_day
    or old.timezone is distinct from new.timezone
    or old.location_type is distinct from new.location_type
    or old.venue_name is distinct from new.venue_name
    or old.address is distinct from new.address
    or old.formatted_address is distinct from new.formatted_address
    or old.map_url is distinct from new.map_url
    or old.meeting_url is distinct from new.meeting_url
    or old.meeting_provider is distinct from new.meeting_provider
    or old.visibility is distinct from new.visibility
    or old.status is distinct from new.status
  ) then
    source_id := new.id;
    next_operation := 'sync';
    next_event_id := new.id;
  else
    return new;
  end if;

  insert into public.google_calendar_sync_jobs (
    event_id,
    calendar_event_id,
    operation,
    status,
    run_after,
    locked_at,
    last_error
  ) values (
    next_event_id,
    public.google_calendar_event_id(source_id),
    next_operation,
    'pending',
    now(),
    null,
    null
  )
  on conflict (calendar_event_id) do update set
    event_id = excluded.event_id,
    operation = excluded.operation,
    status = 'pending',
    run_after = now(),
    locked_at = null,
    last_error = null,
    updated_at = now();

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists events_google_calendar_sync_queue on public.events;
create trigger events_google_calendar_sync_queue
after insert or update or delete on public.events
for each row execute function public.enqueue_google_calendar_sync_job();

-- Claim atomically so two Cron invocations do not process the same event.
-- Jobs stuck in processing for 15 minutes become eligible again.
create or replace function public.claim_google_calendar_sync_jobs(p_limit integer default 10)
returns setof public.google_calendar_sync_jobs
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select id
    from public.google_calendar_sync_jobs
    where (
      status in ('pending', 'failed')
      and run_after <= now()
    )
    or (
      status = 'processing'
      and locked_at < now() - interval '15 minutes'
    )
    order by run_after asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.google_calendar_sync_jobs as job
  set
    status = 'processing',
    attempts = job.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
$$;

revoke all on function public.google_calendar_event_id(uuid) from public, anon, authenticated;
revoke all on function public.enqueue_google_calendar_sync_job() from public, anon, authenticated;
revoke all on function public.claim_google_calendar_sync_jobs(integer) from public, anon, authenticated;
grant execute on function public.google_calendar_event_id(uuid) to service_role;
grant execute on function public.claim_google_calendar_sync_jobs(integer) to service_role;
