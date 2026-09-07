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
          select 1 from public.communities as communities where communities.logo_path = objects.name
       ))
     );
$$;

revoke all on function public.list_orphaned_asset_paths(text, interval) from public, anon, authenticated;
grant execute on function public.list_orphaned_asset_paths(text, interval) to service_role;
