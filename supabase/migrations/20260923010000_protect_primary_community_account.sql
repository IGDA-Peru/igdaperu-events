-- Keep the primary IGDA Peru account present in every community.
-- The UI hides removal controls, while this trigger also protects direct
-- database/API attempts and future admin flows.

create or replace function public.prevent_primary_community_account_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_TABLE_NAME = 'memberships'
     and (
       TG_OP = 'DELETE'
       or (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status and NEW.status = 'revoked')
     )
     and exists (
       select 1
       from auth.users protected_user
       where protected_user.id = OLD.user_id
         and lower(trim(coalesce(protected_user.email, ''))) = 'contacto@igda.pe'
     ) then
    raise exception 'The primary community account cannot be removed';
  end if;

  if TG_TABLE_NAME = 'invitations'
     and TG_OP = 'DELETE'
     and lower(trim(coalesce(OLD.email, ''))) = 'contacto@igda.pe' then
    raise exception 'The primary community invitation cannot be cancelled';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

revoke all on function public.prevent_primary_community_account_removal() from public, anon, authenticated;

drop trigger if exists protect_primary_community_membership on public.memberships;
create trigger protect_primary_community_membership
before update of status or delete on public.memberships
for each row execute function public.prevent_primary_community_account_removal();

drop trigger if exists protect_primary_community_invitation on public.invitations;
create trigger protect_primary_community_invitation
before delete on public.invitations
for each row execute function public.prevent_primary_community_account_removal();
