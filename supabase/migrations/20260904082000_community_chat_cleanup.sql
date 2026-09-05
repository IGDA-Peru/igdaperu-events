create or replace function public.create_community_conversation(
  p_target_community_id uuid,
  p_source_community_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_community_id uuid;
  first_community_id uuid;
  second_community_id uuid;
  new_conversation_id uuid;
  current_status public.community_conversation_status;
begin
  if public.is_platform_admin() then
    select id into source_community_id
    from public.communities
    where slug = 'igda-peru' and status = 'approved';
  else
    source_community_id := p_source_community_id;
  end if;

  if source_community_id is null or not public.can_chat_as_community(source_community_id) then
    raise exception 'No tienes permisos para representar esta comunidad';
  end if;

  if not exists (
    select 1 from public.communities
    where id = p_target_community_id and status = 'approved'
  ) then
    raise exception 'La comunidad destino no está disponible';
  end if;
  if source_community_id = p_target_community_id then raise exception 'No puedes iniciar una conversación con la misma comunidad'; end if;

  first_community_id := least(source_community_id, p_target_community_id);
  second_community_id := greatest(source_community_id, p_target_community_id);

  select conversations.id, conversations.status into new_conversation_id, current_status
  from public.community_conversations conversations
  where conversations.community_a_id = first_community_id and conversations.community_b_id = second_community_id
  for update;

  if current_status = 'active' then raise exception 'Ya existe una conversación activa entre estas comunidades'; end if;
  if current_status = 'pending' then raise exception 'Ya existe una solicitud pendiente entre estas comunidades'; end if;

  if new_conversation_id is null then
    insert into public.community_conversations (
      community_a_id, community_b_id, requested_by_community_id, requested_by_user_id
    ) values (
      first_community_id, second_community_id, source_community_id, (select auth.uid())
    ) returning id into new_conversation_id;
  else
    update public.community_conversations
    set requested_by_community_id = source_community_id,
        requested_by_user_id = (select auth.uid()),
        status = 'pending',
        responded_by_user_id = null,
        responded_at = null,
        updated_at = now()
    where id = new_conversation_id;
  end if;

  insert into public.community_conversation_participants (conversation_id, community_id)
  values (new_conversation_id, source_community_id), (new_conversation_id, p_target_community_id)
  on conflict (conversation_id, community_id) do nothing;

  return new_conversation_id;
end;
$$;
