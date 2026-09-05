# Sincronización automática con Google Calendar

La sincronización usa una cola coalescida y una reconciliación nocturna:

- Cada alta, edición, publicación, archivado o eliminación de un evento crea o actualiza una sola tarea para ese evento.
- Un procesador atiende hasta 10 tareas cada 5 minutos y reintenta los fallos con backoff.
- Una reconciliación completa nocturna compara todos los eventos administrados. Solo actualiza los que cambiaron y elimina los que ya no deben publicarse.

## Activación en Supabase

La migración crea la cola, el trigger y la función atómica para reclamar tareas. En este proyecto también dejó activos los dos trabajos de Cron usando un secreto interno que no se expone al navegador.

1. En Supabase Dashboard abre **Project Settings → Vault**.
2. Para configurar otro entorno, crea un secreto llamado `google_calendar_sync_cron_secret` y configura el mismo valor como secret de la Edge Function `GOOGLE_CALENDAR_SYNC_CRON_SECRET`. Debe ser un valor aleatorio y no debe guardarse en el frontend ni en el repositorio.
3. En **SQL Editor** ejecuta una sola vez el siguiente bloque, cambiando el nombre del proyecto en la URL si corresponde:

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'google-calendar-sync-queue',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://vqjatmuozhpblucpiiqw.supabase.co/functions/v1/sync-google-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_sync_cron_secret')
    ),
    body := '{"mode":"queue"}'::jsonb
  );
  $$
);

select cron.schedule(
  'google-calendar-sync-nightly',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://vqjatmuozhpblucpiiqw.supabase.co/functions/v1/sync-google-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_calendar_sync_cron_secret')
    ),
    body := '{"mode":"full"}'::jsonb
  );
  $$
);
```

El horario nocturno es `03:00` en Lima (`08:00 UTC`). Para revisar ejecuciones:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname in ('google-calendar-sync-queue', 'google-calendar-sync-nightly');

select * from cron.job_run_details
where jobname in ('google-calendar-sync-queue', 'google-calendar-sync-nightly')
order by start_time desc
limit 20;
```

Si se ejecuta el bloque más de una vez, primero elimina los trabajos existentes desde el panel de Cron o con `select cron.unschedule(jobid)` usando los `jobid` devueltos por `cron.job`.
