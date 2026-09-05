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
  target_community public.communities%rowtype;
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

  select * into target_community
  from public.communities
  where id = p_target_community_id and status = 'approved';
  if not found then raise exception 'La comunidad destino no está disponible'; end if;
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

create or replace function public.send_community_message(
  p_conversation_id uuid,
  p_community_id uuid,
  p_body text
)
returns table (
  id uuid,
  conversation_id uuid,
  author_user_id uuid,
  author_community_id uuid,
  author_community_name text,
  author_community_slug text,
  author_community_logo_path text,
  author_display_name text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  conversation public.community_conversations%rowtype;
  author_name text;
  inserted_message public.community_messages%rowtype;
begin
  if not public.can_chat_as_community(p_community_id) then raise exception 'No tienes permisos para representar esta comunidad'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'El mensaje debe tener entre 1 y 2000 caracteres'; end if;

  select conversations.* into conversation
  from public.community_conversations conversations
  where conversations.id = p_conversation_id;
  if not found or conversation.status <> 'active' then raise exception 'La conversación no está activa'; end if;
  if p_community_id not in (conversation.community_a_id, conversation.community_b_id) then raise exception 'Esta comunidad no participa en la conversación'; end if;

  select coalesce(nullif(trim(profile.display_name), ''), 'Miembro de la comunidad') into author_name
  from public.profiles profile where profile.id = (select auth.uid());
  author_name := coalesce(author_name, 'Miembro de la comunidad');

  insert into public.community_messages (conversation_id, author_user_id, author_community_id, author_display_name, body)
  values (p_conversation_id, (select auth.uid()), p_community_id, author_name, btrim(p_body))
  returning * into inserted_message;

  update public.community_conversations
  set last_message_at = inserted_message.created_at, updated_at = now()
  where public.community_conversations.id = p_conversation_id;

  update public.community_conversation_participants
  set archived_at = null
  where community_conversation_participants.conversation_id = p_conversation_id
    and community_conversation_participants.community_id = p_community_id;

  return query
  select inserted_message.id, inserted_message.conversation_id, inserted_message.author_user_id,
    inserted_message.author_community_id, community.name, community.slug, community.logo_path,
    inserted_message.author_display_name, inserted_message.body, inserted_message.created_at
  from public.communities community where community.id = inserted_message.author_community_id;
end;
$$;

grant execute on function public.create_community_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_community_message(uuid, uuid, text) to authenticated;
