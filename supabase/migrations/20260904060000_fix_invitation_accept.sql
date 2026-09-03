-- Califica las columnas de memberships para evitar ambigüedad con las
-- variables de salida de accept_invitation.
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

  update public.memberships as membership
     set role = invitation_row.role,
         status = 'active',
         invited_by = invitation_row.invited_by,
         joined_at = coalesce(membership.joined_at, now())
   where membership.user_id = (select auth.uid())
     and membership.community_id = invitation_row.community_id;

  update public.invitations
     set accepted_at = now()
   where id = invitation_row.id;

  return query select invitation_row.community_id, invitation_row.role;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;
