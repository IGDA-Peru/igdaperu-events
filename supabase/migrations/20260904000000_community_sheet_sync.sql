-- Sincronización manual y bajo demanda desde la hoja privada "TO NOTION".
-- Los campos de contacto permanecen separados de communities porque esa tabla
-- se consulta desde la agenda pública.

alter table public.communities
  add column if not exists source_id text,
  add column if not exists source_system text not null default 'manual',
  add column if not exists founded_on date,
  add column if not exists categories text not null default '',
  add column if not exists activities text not null default '',
  add column if not exists headquarters text not null default '',
  add column if not exists organization_nature text not null default '',
  add column if not exists social_networks text not null default '',
  add column if not exists linktree_url text,
  add column if not exists source_validated boolean not null default false,
  add column if not exists source_updated_at timestamptz,
  add column if not exists last_synced_at timestamptz;

create unique index if not exists communities_source_id_unique
  on public.communities (source_id)
  where source_id is not null;

create index if not exists communities_source_lookup_idx
  on public.communities (source_system, source_id)
  where source_id is not null;

create table if not exists public.community_contacts (
  community_id uuid primary key references public.communities(id) on delete cascade,
  primary_representative text not null default '',
  secondary_representative text not null default '',
  contact_email text not null default '',
  active_members text not null default '',
  additional_info text not null default '',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_contacts_updated_idx
  on public.community_contacts (updated_at desc);

drop trigger if exists community_contacts_set_updated_at on public.community_contacts;
create trigger community_contacts_set_updated_at
before update on public.community_contacts
for each row execute function public.set_updated_at();

create table if not exists public.community_sync_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  details jsonb not null default '{}'::jsonb
);

create index if not exists community_sync_runs_requested_idx
  on public.community_sync_runs (requested_by, started_at desc);

create index if not exists community_sync_runs_status_idx
  on public.community_sync_runs (status, started_at desc);

-- El RPC se ejecuta únicamente desde la Edge Function con service_role.
-- Al actualizar se omite status: una suspensión manual nunca se revierte por
-- una nueva importación de la hoja. Las comunidades nuevas sí nacen aprobadas.
create or replace function public.sync_community_rows(p_rows jsonb)
returns table (source_id text, community_id uuid, action text, message text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  v_source_id text;
  v_name text;
  v_existing_id uuid;
  v_slug text;
  v_name_matches integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'The sync payload must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    v_source_id := nullif(left(trim(item ->> 'source_id'), 160), '');
    v_name := nullif(left(trim(item ->> 'name'), 120), '');
    source_id := v_source_id;
    community_id := null;
    message := null;

    if v_source_id is null then
      action := 'skipped';
      message := 'Falta ID de sincronización';
      return next;
      continue;
    end if;

    if v_name is null then
      action := 'skipped';
      message := 'Falta el nombre de la comunidad';
      return next;
      continue;
    end if;

    select c.id
      into v_existing_id
      from public.communities c
     where c.source_id = v_source_id
     limit 1;

    -- Vincula la primera importación con comunidades creadas previamente en
    -- el panel (por ejemplo, IGDA Perú) sin duplicarlas.
    if v_existing_id is null then
      select count(*)
        into v_name_matches
        from public.communities c
       where c.source_id is null
         and lower(trim(c.name)) = lower(trim(v_name));

      if v_name_matches = 1 then
        select c.id
          into v_existing_id
          from public.communities c
         where c.source_id is null
           and lower(trim(c.name)) = lower(trim(v_name))
         limit 1;
      elsif v_name_matches > 1 then
        action := 'skipped';
        message := 'Hay varias comunidades existentes con el mismo nombre';
        return next;
        continue;
      end if;
    end if;

    v_slug := nullif(trim(item ->> 'slug'), '');

    if v_existing_id is null then
      insert into public.communities (
        slug,
        name,
        description,
        website_url,
        linktree_url,
        founded_on,
        categories,
        activities,
        headquarters,
        organization_nature,
        social_networks,
        source_id,
        source_system,
        source_validated,
        source_updated_at,
        last_synced_at,
        status,
        approved_at
      )
      values (
        v_slug,
        v_name,
        coalesce(item ->> 'description', ''),
        nullif(item ->> 'website_url', ''),
        nullif(item ->> 'linktree_url', ''),
        nullif(item ->> 'founded_on', '')::date,
        coalesce(item ->> 'categories', ''),
        coalesce(item ->> 'activities', ''),
        coalesce(item ->> 'headquarters', ''),
        coalesce(item ->> 'organization_nature', ''),
        coalesce(item ->> 'social_networks', ''),
        v_source_id,
        'google_sheets',
        coalesce((item ->> 'source_validated')::boolean, false),
        nullif(item ->> 'source_updated_at', '')::timestamptz,
        nullif(item ->> 'last_synced_at', '')::timestamptz,
        'approved',
        now()
      )
      returning id into v_existing_id;
      action := 'created';
    else
      update public.communities
         set source_id = v_source_id,
             source_system = 'google_sheets',
             name = v_name,
             description = coalesce(item ->> 'description', ''),
             website_url = nullif(item ->> 'website_url', ''),
             linktree_url = nullif(item ->> 'linktree_url', ''),
             founded_on = nullif(item ->> 'founded_on', '')::date,
             categories = coalesce(item ->> 'categories', ''),
             activities = coalesce(item ->> 'activities', ''),
             headquarters = coalesce(item ->> 'headquarters', ''),
             organization_nature = coalesce(item ->> 'organization_nature', ''),
             social_networks = coalesce(item ->> 'social_networks', ''),
             source_validated = coalesce((item ->> 'source_validated')::boolean, false),
             source_updated_at = nullif(item ->> 'source_updated_at', '')::timestamptz,
             last_synced_at = nullif(item ->> 'last_synced_at', '')::timestamptz
       where id = v_existing_id;
      action := 'updated';
    end if;

    community_id := v_existing_id;

    insert into public.community_contacts (
      community_id,
      primary_representative,
      secondary_representative,
      contact_email,
      active_members,
      additional_info,
      source_updated_at
    )
    values (
      v_existing_id,
      coalesce(item ->> 'primary_representative', ''),
      coalesce(item ->> 'secondary_representative', ''),
      coalesce(item ->> 'contact_email', ''),
      coalesce(item ->> 'active_members', ''),
      coalesce(item ->> 'additional_info', ''),
      nullif(item ->> 'source_updated_at', '')::timestamptz
    )
    on conflict (community_id) do update set
      primary_representative = excluded.primary_representative,
      secondary_representative = excluded.secondary_representative,
      contact_email = excluded.contact_email,
      active_members = excluded.active_members,
      additional_info = excluded.additional_info,
      source_updated_at = excluded.source_updated_at;

    return next;
  end loop;
end;
$$;

revoke execute on function public.sync_community_rows(jsonb) from public, anon, authenticated;
grant execute on function public.sync_community_rows(jsonb) to service_role;

alter table public.community_contacts enable row level security;
alter table public.community_sync_runs enable row level security;

create policy community_contacts_admin_read
  on public.community_contacts for select to authenticated
  using (
    public.is_platform_admin()
    or public.has_community_role(community_id, array['community_admin']::public.app_role[])
  );

create policy community_contacts_admin_manage
  on public.community_contacts for all to authenticated
  using (
    public.is_platform_admin()
    or public.has_community_role(community_id, array['community_admin']::public.app_role[])
  )
  with check (
    public.is_platform_admin()
    or public.has_community_role(community_id, array['community_admin']::public.app_role[])
  );

create policy community_sync_runs_platform_read
  on public.community_sync_runs for select to authenticated
  using (public.is_platform_admin());
