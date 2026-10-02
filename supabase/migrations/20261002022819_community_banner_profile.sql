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
    ('divgames', 'https://igda.pe/images/communities/divgames.png'),
    ('game-dev-friends', 'https://igda.pe/images/communities/game-dev-friends.png'),
    ('igda-peru', 'https://igda.pe/images/communities/igda-peru.png')
  ) as legacy(slug, banner_url)
 where communities.slug = legacy.slug
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
