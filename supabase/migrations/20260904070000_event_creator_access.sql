-- Los administradores y editores pueden identificar al creador de los eventos
-- que ya tienen permiso para gestionar, sin exponer auth.users al navegador.
create or replace function public.list_event_creator_emails(p_event_ids uuid[])
returns table(event_id uuid, email text)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select e.id, lower(trim(u.email))::text
    from public.events e
    join auth.users u on u.id = e.created_by
   where e.id = any(coalesce(p_event_ids, array[]::uuid[]))
     and u.email is not null
     and public.has_community_role(
       e.community_id,
       array['community_editor', 'community_admin']::public.app_role[]
     )
   order by lower(trim(u.email));
$$;

revoke all on function public.list_event_creator_emails(uuid[]) from public, anon;
grant execute on function public.list_event_creator_emails(uuid[]) to authenticated;

-- El creador original no debe poder cambiarse desde una edición posterior.
-- También dejamos registrado quién hizo la última modificación.
create or replace function public.track_event_editor()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The original event creator cannot be changed';
  end if;

  new.updated_by = coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

drop trigger if exists events_track_editor on public.events;
create trigger events_track_editor
before update on public.events
for each row execute function public.track_event_editor();
