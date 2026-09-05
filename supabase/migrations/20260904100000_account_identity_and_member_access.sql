-- Identidad básica de las cuentas y gestión segura de accesos por comunidad.
alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_first_name_length') then
    alter table public.profiles add constraint profiles_first_name_length check (char_length(first_name) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_last_name_length') then
    alter table public.profiles add constraint profiles_last_name_length check (char_length(last_name) <= 80);
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metadata_first_name text := trim(coalesce(new.raw_user_meta_data ->> 'first_name', ''));
  metadata_last_name text := trim(coalesce(new.raw_user_meta_data ->> 'last_name', ''));
  metadata_display_name text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  insert into public.profiles (id, first_name, last_name, display_name)
  values (
    new.id,
    metadata_first_name,
    metadata_last_name,
    coalesce(nullif(metadata_display_name, ''), nullif(trim(concat_ws(' ', metadata_first_name, metadata_last_name)), ''), '')
  )
  on conflict (id) do update set
    first_name = case when excluded.first_name <> '' then excluded.first_name else public.profiles.first_name end,
    last_name = case when excluded.last_name <> '' then excluded.last_name else public.profiles.last_name end,
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.profiles.display_name end;
  return new;
end;
$$;

create or replace function public.list_community_members(p_community_id uuid)
returns table (
  membership_id uuid,
  invitation_id uuid,
  email text,
  role public.app_role,
  status public.membership_status
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin()
     and not public.has_community_role(p_community_id, array['community_admin']::public.app_role[]) then
    raise exception 'Not authorized to view community members';
  end if;

  return query
  with entries as (
    select
      membership.id as membership_id,
      null::uuid as invitation_id,
      lower(trim(auth_user.email))::text as email,
      membership.role,
      membership.status
    from public.memberships as membership
    join auth.users as auth_user on auth_user.id = membership.user_id
    where membership.community_id = p_community_id
      and membership.status in ('active', 'invited')

    union all

    select
      null::uuid as membership_id,
      invitation.id as invitation_id,
      lower(trim(invitation.email))::text as email,
      invitation.role,
      'invited'::public.membership_status as status
    from public.invitations as invitation
    where invitation.community_id = p_community_id
      and invitation.accepted_at is null
      and invitation.expires_at > now()
      and not exists (
        select 1
        from public.memberships as active_membership
        join auth.users as active_user on active_user.id = active_membership.user_id
        where active_membership.community_id = invitation.community_id
          and active_membership.status in ('active', 'invited')
          and lower(trim(active_user.email)) = lower(trim(invitation.email))
      )
  )
  select entries.membership_id, entries.invitation_id, entries.email, entries.role, entries.status
  from entries
  order by entries.email, entries.status;
end;
$$;

revoke all on function public.list_community_members(uuid) from public, anon;
grant execute on function public.list_community_members(uuid) to authenticated;

create or replace function public.revoke_community_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  membership_row public.memberships%rowtype;
  current_user_id uuid := (select auth.uid());
begin
  select * into membership_row
  from public.memberships
  where id = p_membership_id
  for update;

  if not found then
    raise exception 'Membership not found';
  end if;
  if membership_row.user_id = current_user_id then
    raise exception 'You cannot revoke your own access';
  end if;
  if not public.is_platform_admin()
     and not public.has_community_role(membership_row.community_id, array['community_admin']::public.app_role[]) then
    raise exception 'Not authorized to revoke this membership';
  end if;
  if not public.is_platform_admin() and membership_row.role <> 'community_editor' then
    raise exception 'Community administrators can only revoke editor access';
  end if;

  update public.memberships
  set status = 'revoked'
  where id = membership_row.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    current_user_id,
    'membership.revoked',
    'membership',
    membership_row.id,
    jsonb_build_object('community_id', membership_row.community_id, 'user_id', membership_row.user_id, 'role', membership_row.role)
  );
end;
$$;

revoke all on function public.revoke_community_member(uuid) from public, anon;
grant execute on function public.revoke_community_member(uuid) to authenticated;

create or replace function public.cancel_community_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation_row public.invitations%rowtype;
  current_user_id uuid := (select auth.uid());
begin
  select * into invitation_row
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;
  if invitation_row.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;
  if not public.is_platform_admin()
     and not public.has_community_role(invitation_row.community_id, array['community_admin']::public.app_role[]) then
    raise exception 'Not authorized to cancel this invitation';
  end if;
  if not public.is_platform_admin() and invitation_row.role <> 'community_editor' then
    raise exception 'Community administrators can only cancel editor invitations';
  end if;

  delete from public.invitations where id = invitation_row.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    current_user_id,
    'invitation.cancelled',
    'invitation',
    invitation_row.id,
    jsonb_build_object('community_id', invitation_row.community_id, 'email', invitation_row.email, 'role', invitation_row.role)
  );
end;
$$;

revoke all on function public.cancel_community_invitation(uuid) from public, anon;
grant execute on function public.cancel_community_invitation(uuid) to authenticated;
