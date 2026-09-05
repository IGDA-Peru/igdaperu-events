alter table public.events
  add column if not exists is_all_day boolean not null default false;

create index if not exists events_conflict_lookup_idx
  on public.events (status, visibility, starts_at, ends_at)
  where status = 'published' and starts_at is not null and ends_at is not null;
