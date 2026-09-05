-- Programa el procesador y la reconciliación solo cuando el secreto de Vault
-- ya está disponible. Así los entornos nuevos no quedan con jobs rotos.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $schedule$
begin
  if to_regnamespace('cron') is null or to_regnamespace('net') is null then
    return;
  end if;

  if not exists (
    select 1 from vault.secrets where name = 'google_calendar_sync_cron_secret'
  ) then
    return;
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'google-calendar-sync-queue'
  ) then
    perform cron.schedule(
      'google-calendar-sync-queue',
      '*/5 * * * *',
      $cron$
      select net.http_post(
        url := 'https://vqjatmuozhpblucpiiqw.supabase.co/functions/v1/sync-google-calendar',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_sync_cron_secret')
        ),
        body := '{"mode":"queue"}'::jsonb
      );
      $cron$
    );
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'google-calendar-sync-nightly'
  ) then
    perform cron.schedule(
      'google-calendar-sync-nightly',
      '0 8 * * *',
      $cron$
      select net.http_post(
        url := 'https://vqjatmuozhpblucpiiqw.supabase.co/functions/v1/sync-google-calendar',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_sync_cron_secret')
        ),
        body := '{"mode":"full"}'::jsonb
      );
      $cron$
    );
  end if;
end
$schedule$;
