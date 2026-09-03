create extension if not exists pgcrypto;

create type public.community_status as enum ('pending', 'approved', 'suspended');
create type public.app_role as enum ('reader', 'community_editor', 'community_admin', 'platform_admin');
create type public.membership_status as enum ('active', 'invited', 'revoked');
create type public.event_status as enum ('draft', 'published', 'archived');
create type public.event_visibility as enum ('public', 'network');
create type public.location_type as enum ('venue', 'online', 'hybrid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  logo_path text,
  website_url text check (website_url is null or website_url ~* '^https?://'),
  discord_url text check (discord_url is null or discord_url ~* '^https?://'),
  status public.community_status not null default 'pending',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_role_scope check (
    (role = 'platform_admin' and community_id is null)
    or (role <> 'platform_admin' and community_id is not null)
  )
);

create unique index memberships_user_community_unique
  on public.memberships (user_id, coalesce(community_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 3 and 5000),
  type text not null default 'CHARLA' check (char_length(type) between 2 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Lima',
  location_type public.location_type not null default 'venue',
  venue_name text,
  address text,
  meeting_url text check (meeting_url is null or meeting_url ~* '^https?://'),
  cover_path text,
  visibility public.event_visibility not null default 'public',
  status public.event_status not null default 'draft',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at),
  constraint events_online_link check (location_type = 'venue' or meeting_url is not null)
);

create unique index events_slug_unique on public.events (slug);
create index events_public_listing_idx on public.events (status, visibility, starts_at);
create index events_community_schedule_idx on public.events (community_id, starts_at);
create index events_community_status_idx on public.events (community_id, status);
create index memberships_user_idx on public.memberships (user_id, status);
create index memberships_community_idx on public.memberships (community_id, status);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.app_role not null check (role in ('community_editor', 'community_admin')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_lookup_idx on public.invitations (token_hash, expires_at) where accepted_at is null;
create index invitations_community_idx on public.invitations (community_id, created_at desc);

create table public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index event_reports_unresolved_idx on public.event_reports (created_at desc) where resolved_at is null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger communities_set_updated_at before update on public.communities for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where user_id = (select auth.uid())
      and role = 'platform_admin'
      and status = 'active'
  );
$$;

create or replace function public.has_community_role(target_community_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.memberships
    where user_id = (select auth.uid())
      and community_id = target_community_id
      and role = any(allowed_roles)
      and status = 'active'
  );
$$;

create or replace function public.protect_community_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() and new.status is distinct from old.status then
    raise exception 'Only platform administrators can change community status';
  end if;
  if new.status = 'approved' and old.status is distinct from new.status then
    new.approved_at = coalesce(new.approved_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.accept_invitation(p_token_hash text)
returns table (community_id uuid, role public.app_role)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation_row public.invitations%rowtype;
  current_email text;
begin
  select * into invitation_row
  from public.invitations
  where token_hash = p_token_hash and accepted_at is null
  for update;

  if not found then
    raise exception 'Invitation not found or already used';
  end if;
  if invitation_row.expires_at <= now() then
    raise exception 'Invitation expired';
  end if;

  select email into current_email from auth.users where id = (select auth.uid());
  if current_email is null or lower(current_email) <> lower(invitation_row.email) then
    raise exception 'Invitation email does not match current user';
  end if;

  insert into public.memberships (user_id, community_id, role, status, invited_by, joined_at)
  values ((select auth.uid()), invitation_row.community_id, invitation_row.role, 'active', invitation_row.invited_by, now())
  on conflict do nothing;

  update public.memberships
  set role = invitation_row.role, status = 'active', invited_by = invitation_row.invited_by, joined_at = coalesce(joined_at, now())
  where user_id = (select auth.uid()) and community_id = invitation_row.community_id;

  update public.invitations set accepted_at = now() where id = invitation_row.id;
  return query select invitation_row.community_id, invitation_row.role;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

create trigger communities_protect_status before update on public.communities for each row execute function public.protect_community_status();

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.memberships enable row level security;
alter table public.events enable row level security;
alter table public.invitations enable row level security;
alter table public.event_reports enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_platform_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy communities_public_read on public.communities for select to anon, authenticated using (status = 'approved');
create policy communities_admin_read on public.communities for select to authenticated using (public.is_platform_admin() or public.has_community_role(id, array['community_admin']::public.app_role[]));
create policy communities_platform_insert on public.communities for insert to authenticated with check (public.is_platform_admin() and created_by = (select auth.uid()));
create policy communities_platform_update on public.communities for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy communities_admin_update on public.communities for update to authenticated using (public.has_community_role(id, array['community_admin']::public.app_role[])) with check (public.has_community_role(id, array['community_admin']::public.app_role[]));

create policy memberships_own_read on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy memberships_admin_read on public.memberships for select to authenticated using (public.is_platform_admin() or public.has_community_role(community_id, array['community_admin']::public.app_role[]));
create policy memberships_platform_manage on public.memberships for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy events_public_read on public.events for select to anon using (
  status = 'published' and visibility = 'public'
  and exists (select 1 from public.communities c where c.id = community_id and c.status = 'approved')
);
create policy events_network_read on public.events for select to authenticated using (
  status = 'published' and visibility in ('public', 'network')
  and exists (select 1 from public.communities c where c.id = community_id and c.status = 'approved')
);
create policy events_manager_read on public.events for select to authenticated using (
  public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
);
create policy events_platform_read on public.events for select to authenticated using (public.is_platform_admin());
create policy events_manager_insert on public.events for insert to authenticated with check (
  public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
  and created_by = (select auth.uid())
);
create policy events_manager_update on public.events for update to authenticated using (
  public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
) with check (
  public.has_community_role(community_id, array['community_editor', 'community_admin']::public.app_role[])
);
create policy events_manager_delete on public.events for delete to authenticated using (
  public.has_community_role(community_id, array['community_admin']::public.app_role[])
);
create policy events_platform_manage on public.events for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy invitations_admin_read on public.invitations for select to authenticated using (public.is_platform_admin() or public.has_community_role(community_id, array['community_admin']::public.app_role[]));
create policy invitations_platform_manage on public.invitations for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy reports_authenticated_insert on public.event_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy reports_own_read on public.event_reports for select to authenticated using (reporter_id = (select auth.uid()) or public.is_platform_admin());
create policy reports_platform_manage on public.event_reports for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy audit_platform_read on public.audit_log for select to authenticated using (public.is_platform_admin());

create or replace function public.storage_community_id(path text)
returns uuid
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
begin
  return (split_part(path, '/', 1))::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

insert into storage.buckets (id, name, public)
values ('community-assets', 'community-assets', true)
on conflict (id) do nothing;

create policy community_assets_public_read on storage.objects for select using (bucket_id = 'community-assets');
create policy community_assets_manager_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'community-assets'
  and public.has_community_role(public.storage_community_id(name), array['community_admin']::public.app_role[])
);
create policy community_assets_manager_update on storage.objects for update to authenticated using (
  bucket_id = 'community-assets'
  and public.has_community_role(public.storage_community_id(name), array['community_admin']::public.app_role[])
);
create policy community_assets_manager_delete on storage.objects for delete to authenticated using (
  bucket_id = 'community-assets'
  and public.has_community_role(public.storage_community_id(name), array['community_admin']::public.app_role[])
);
