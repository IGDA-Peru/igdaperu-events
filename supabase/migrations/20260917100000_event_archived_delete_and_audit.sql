-- Los eventos archivados son eliminables por sus administradores.
-- Los eventos activos que ya terminaron siguen requiriendo archivado previo.
drop policy if exists events_manager_delete on public.events;
drop policy if exists events_platform_delete on public.events;
drop policy if exists events_authenticated_delete on public.events;

create policy events_authenticated_delete
  on public.events for delete to authenticated
  using (
    (
      status = 'archived'
      or (status = 'draft' and ends_at is null)
      or ends_at > now()
    )
    and (
      public.has_community_role(community_id, array['community_admin']::public.app_role[])
      or public.is_platform_admin()
    )
  );

-- La auditoría se realiza en PostgreSQL para cubrir cambios hechos desde el
-- panel, funciones internas y tareas programadas, no solo el navegador.
create or replace function public.audit_event_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_action text;
  changed_fields jsonb;
  audit_entity_id uuid;
  audit_metadata jsonb;
begin
  if tg_op = 'DELETE' then
    event_action := 'event.deleted';
    audit_entity_id := old.id;
    audit_metadata := jsonb_build_object(
      'community_id', old.community_id,
      'title', old.title,
      'slug', old.slug,
      'status', old.status,
      'visibility', old.visibility,
      'starts_at', old.starts_at,
      'ends_at', old.ends_at
    );
  else
    -- updated_at y updated_by son campos operativos y no cuentan como una
    -- modificación de contenido hecha por el usuario.
    select coalesce(jsonb_agg(field order by field), '[]'::jsonb)
      into changed_fields
      from (
        select coalesce(old_fields.key, new_fields.key) as field
          from jsonb_each(to_jsonb(old) - 'updated_at' - 'updated_by') as old_fields
          full join jsonb_each(to_jsonb(new) - 'updated_at' - 'updated_by') as new_fields
            on old_fields.key = new_fields.key
         where old_fields.value is distinct from new_fields.value
      ) as differences;

    if jsonb_array_length(changed_fields) = 0 then
      return new;
    end if;

    event_action := case
      when old.status is distinct from new.status and new.status = 'archived' then 'event.archived'
      else 'event.updated'
    end;
    audit_entity_id := new.id;
    audit_metadata := jsonb_build_object(
      'community_id', new.community_id,
      'title', new.title,
      'slug', new.slug,
      'status_before', old.status,
      'status_after', new.status,
      'changed_fields', changed_fields
    );
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), event_action, 'event', audit_entity_id, audit_metadata);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_event_change() from public, anon, authenticated;

drop trigger if exists events_audit_changes on public.events;
create trigger events_audit_changes
after update or delete on public.events
for each row execute function public.audit_event_change();
