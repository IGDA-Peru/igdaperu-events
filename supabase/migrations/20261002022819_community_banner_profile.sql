-- Las comunidades pueden publicar un banner propio en sus perfiles.
alter table public.communities
  add column if not exists banner_path text;

comment on column public.communities.banner_path is
  'Ruta del banner público de la comunidad en el bucket community-assets.';

-- igda.pe consume únicamente el identificador compartido y la ruta del banner.
-- security_invoker conserva la política RLS de communities (solo aprobadas).
create or replace view public.igda_site_community_banners
with (security_invoker = true)
as
select source_id, banner_path
  from public.communities
 where status = 'approved'
   and source_id is not null
   and banner_path is not null;

revoke all on public.igda_site_community_banners from public, anon, authenticated;
grant select on public.igda_site_community_banners to anon, authenticated;

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
