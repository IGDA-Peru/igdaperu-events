-- Devuelve únicamente los correos de usuarios con acceso activo a una comunidad.
-- No expone nombres, contraseñas ni columnas de auth.users adicionales.

create or replace function public.list_community_member_emails(p_community_id uuid)
returns table(email text)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not (
    public.is_platform_admin()
    or public.has_community_role(p_community_id, array['community_admin']::public.app_role[])
  ) then
    raise exception 'Not authorized to view community member emails';
  end if;

  return query
  select lower(trim(u.email))::text
    from public.memberships m
    join auth.users u on u.id = m.user_id
   where m.community_id = p_community_id
     and m.status = 'active'
     and u.email is not null
   order by lower(trim(u.email));
end;
$$;

revoke all on function public.list_community_member_emails(uuid) from public, anon;
grant execute on function public.list_community_member_emails(uuid) to authenticated;

-- La información pública se mantiene desde Google Sheets; los administradores
-- de comunidad no deben poder modificarla desde el cliente.
drop policy if exists communities_admin_update on public.communities;

create or replace function public.protect_community_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  -- service_role y los procesos de sincronización pueden actualizar los datos
  -- heredados; un administrador de comunidad solo puede cambiar logo_path.
  if (select auth.uid()) is not null and not public.is_platform_admin() then
    if new.id is distinct from old.id
      or new.slug is distinct from old.slug
      or new.name is distinct from old.name
      or new.description is distinct from old.description
      or new.website_url is distinct from old.website_url
      or new.discord_url is distinct from old.discord_url
      or new.status is distinct from old.status
      or new.created_by is distinct from old.created_by
      or new.approved_at is distinct from old.approved_at
      or new.created_at is distinct from old.created_at
      or new.source_id is distinct from old.source_id
      or new.source_system is distinct from old.source_system
      or new.founded_on is distinct from old.founded_on
      or new.categories is distinct from old.categories
      or new.activities is distinct from old.activities
      or new.headquarters is distinct from old.headquarters
      or new.organization_nature is distinct from old.organization_nature
      or new.social_networks is distinct from old.social_networks
      or new.linktree_url is distinct from old.linktree_url
      or new.source_validated is distinct from old.source_validated
      or new.source_updated_at is distinct from old.source_updated_at
      or new.last_synced_at is distinct from old.last_synced_at then
      raise exception 'Community public information is read-only';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists communities_protect_public_fields on public.communities;
create trigger communities_protect_public_fields
before update on public.communities
for each row execute function public.protect_community_public_fields();

create policy communities_admin_logo_update
  on public.communities for update to authenticated
  using (public.has_community_role(id, array['community_admin']::public.app_role[]))
  with check (public.has_community_role(id, array['community_admin']::public.app_role[]));

create or replace function public.assign_igda_platform_accounts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.slug <> 'igda-peru' then
    return new;
  end if;

  update public.memberships target
     set role = 'community_admin',
         status = 'active',
         joined_at = coalesce(target.joined_at, now()),
         updated_at = now()
   where target.community_id = new.id
     and exists (
       select 1
         from public.memberships platform_account
        where platform_account.user_id = target.user_id
          and platform_account.community_id is null
          and platform_account.role = 'platform_admin'
          and platform_account.status = 'active'
     );

  insert into public.memberships (user_id, community_id, role, status, joined_at)
  select platform_account.user_id, new.id, 'community_admin', 'active', now()
    from public.memberships platform_account
   where platform_account.community_id is null
     and platform_account.role = 'platform_admin'
     and platform_account.status = 'active'
     and not exists (
       select 1 from public.memberships target
        where target.user_id = platform_account.user_id
          and target.community_id = new.id
     );

  return new;
end;
$$;

drop trigger if exists communities_assign_igda_platform_accounts on public.communities;
create trigger communities_assign_igda_platform_accounts
after insert or update of slug on public.communities
for each row execute function public.assign_igda_platform_accounts();

-- También cubre la comunidad IGDA Perú si ya existía al aplicar esta migración.
do $$
declare
  igda_id uuid;
begin
  select id into igda_id from public.communities where slug = 'igda-peru' limit 1;
  if igda_id is not null then
    update public.memberships target
       set role = 'community_admin', status = 'active', joined_at = coalesce(target.joined_at, now()), updated_at = now()
     where target.community_id = igda_id
       and exists (
         select 1 from public.memberships platform_account
          where platform_account.user_id = target.user_id
            and platform_account.community_id is null
            and platform_account.role = 'platform_admin'
            and platform_account.status = 'active'
       );
    insert into public.memberships (user_id, community_id, role, status, joined_at)
    select platform_account.user_id, igda_id, 'community_admin', 'active', now()
      from public.memberships platform_account
     where platform_account.community_id is null
       and platform_account.role = 'platform_admin'
       and platform_account.status = 'active'
       and not exists (select 1 from public.memberships target where target.user_id = platform_account.user_id and target.community_id = igda_id);
  end if;
end;
$$;
