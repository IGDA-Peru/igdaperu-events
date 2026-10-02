-- Las comunidades pueden publicar un banner propio en sus perfiles.
alter table public.communities
  add column if not exists banner_path text;

comment on column public.communities.banner_path is
  'Ruta de community-assets o URL legado del banner público de la comunidad.';

-- Conserva en eventos los tres banners que ya publica el directorio de igda.pe.
-- Se reemplazan por una ruta de Storage cuando cada comunidad suba su siguiente banner.
update public.communities as communities
   set banner_path = legacy.banner_url
  from (values
    ('3c025d44-53e0-81dc-a305-db168dca8432', 'https://igda.pe/images/communities/divgames.png'),
    ('3c025d44-53e0-817a-b5b8-d2acb03bcc9d', 'https://igda.pe/images/communities/game-dev-friends.png'),
    ('3d025d44-53e0-81e2-a1ba-e1806e4c6c53', 'https://igda.pe/images/communities/igda-peru.png')
  ) as legacy(source_id, banner_url)
 where communities.source_id = legacy.source_id
   and communities.status = 'approved'
   and communities.banner_path is null;

-- Conserva los banners de comunidad durante la limpieza de archivos huérfanos.
create or replace function public.list_orphaned_asset_paths(
  p_bucket_id text,
  p_min_age interval default interval '24 hours'
)
returns table (name text)
language sql
security definer
stable
set search_path = public, storage, pg_temp
as $$
  select objects.name
    from storage.objects as objects
   where objects.bucket_id = p_bucket_id
     and objects.created_at < now() - p_min_age
     and not (
       (p_bucket_id = 'event-assets' and exists (
          select 1 from public.events as events where events.cover_path = objects.name
       ))
       or
       (p_bucket_id = 'community-assets' and exists (
          select 1 from public.communities as communities
           where communities.logo_path = objects.name
              or communities.banner_path = objects.name
       ))
     );
$$;
