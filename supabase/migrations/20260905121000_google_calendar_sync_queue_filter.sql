-- Los borradores no necesitan tocar Google Calendar. Solo se encolan eventos
-- publicados y las transiciones que puedan retirar uno ya sincronizado.
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
  changed_fields boolean;
  was_publicly_published boolean;
  is_publicly_published boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'published' then return old; end if;
    source_id := old.id;
    next_operation := 'delete';
    next_event_id := null;
  else
    is_publicly_published := new.status = 'published' and new.visibility = 'public';

    if tg_op = 'INSERT' then
      if not is_publicly_published then return new; end if;
      source_id := new.id;
      next_operation := 'sync';
      next_event_id := new.id;
    else
      was_publicly_published := old.status = 'published' and old.visibility = 'public';
      changed_fields := (
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
      );

      if not is_publicly_published and not was_publicly_published then return new; end if;
      source_id := new.id;
      next_operation := case when is_publicly_published then 'sync' else 'delete' end;
      next_event_id := case when is_publicly_published then new.id else null end;
      if is_publicly_published and not changed_fields then return new; end if;
    end if;
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

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.enqueue_google_calendar_sync_job() from public, anon, authenticated;
