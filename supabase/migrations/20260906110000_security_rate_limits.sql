create table if not exists public.function_rate_limits (
  bucket text not null check (char_length(bucket) between 1 and 80),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (bucket, subject_hash)
);

alter table public.function_rate_limits enable row level security;
alter table public.function_rate_limits force row level security;
revoke all on public.function_rate_limits from public, anon, authenticated;
grant all on public.function_rate_limits to service_role;

create or replace function public.consume_function_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row record;
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 80 then
    raise exception 'Invalid rate limit bucket';
  end if;
  if p_subject_hash is null or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate limit subject';
  end if;
  if p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit window';
  end if;
  if p_max_requests is null or p_max_requests not between 1 and 10000 then
    raise exception 'Invalid rate limit threshold';
  end if;

  insert into public.function_rate_limits (bucket, subject_hash, window_started_at, request_count)
  values (p_bucket, p_subject_hash, now(), 1)
  on conflict (bucket, subject_hash) do update set
    window_started_at = case
      when public.function_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then now()
      else public.function_rate_limits.window_started_at
    end,
    request_count = case
      when public.function_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1
      else public.function_rate_limits.request_count + 1
    end
  returning function_rate_limits.window_started_at, function_rate_limits.request_count
  into current_row;

  return query
  select
    current_row.request_count <= p_max_requests,
    greatest(1, ceil(extract(epoch from (current_row.window_started_at + make_interval(secs => p_window_seconds) - now())))::integer);
end;
$$;

revoke all on function public.consume_function_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_function_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.enforce_event_mutation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limit_result record;
begin
  if auth.uid() is null then
    return new;
  end if;

  select *
  into limit_result
  from public.consume_function_rate_limit(
    'event-write-user',
    encode(digest(auth.uid()::text, 'sha256'), 'hex'),
    3600,
    60
  );

  if not limit_result.allowed then
    raise exception using
      errcode = 'P0001',
      message = 'Demasiadas modificaciones de eventos. Intenta nuevamente más tarde.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_event_mutation_rate_limit() from public, anon, authenticated;

drop trigger if exists events_mutation_rate_limit on public.events;
create trigger events_mutation_rate_limit
  before insert or update on public.events
  for each row execute function public.enforce_event_mutation_rate_limit();

create index if not exists event_reports_reporter_recent_idx
  on public.event_reports (reporter_id, created_at desc);
