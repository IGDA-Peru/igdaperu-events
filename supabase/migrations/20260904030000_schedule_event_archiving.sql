create extension if not exists pg_cron with schema extensions;

do $$
begin
  execute $schedule$
    select cron.schedule(
      'archive-expired-events',
      '*/15 * * * *',
      'select public.archive_expired_events();'
    )
  $schedule$;
end;
$$;
