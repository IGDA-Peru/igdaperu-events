create type public.community_conversation_status as enum ('pending', 'active', 'rejected');

create table public.community_conversations (
  id uuid primary key default gen_random_uuid(),
  community_a_id uuid not null references public.communities(id) on delete cascade,
  community_b_id uuid not null references public.communities(id) on delete cascade,
  requested_by_community_id uuid not null references public.communities(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  status public.community_conversation_status not null default 'pending',
  responded_by_user_id uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_conversations_ordered_pair check (community_a_id < community_b_id),
  constraint community_conversations_requester check (requested_by_community_id in (community_a_id, community_b_id))
);

create unique index community_conversations_pair_unique
  on public.community_conversations (community_a_id, community_b_id);
create index community_conversations_a_idx
  on public.community_conversations (community_a_id, status, last_message_at desc);
create index community_conversations_b_idx
  on public.community_conversations (community_b_id, status, last_message_at desc);

create table public.community_conversation_participants (
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  last_read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, community_id)
);

create index community_conversation_participants_community_idx
  on public.community_conversation_participants (community_id, conversation_id);

create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  author_community_id uuid not null references public.communities(id) on delete restrict,
  author_display_name text not null default 'Miembro de la comunidad',
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index community_messages_conversation_idx
  on public.community_messages (conversation_id, created_at desc, id desc);
create index community_messages_author_idx
  on public.community_messages (author_user_id, created_at desc);

create trigger community_conversations_set_updated_at
before update on public.community_conversations
for each row execute function public.set_updated_at();

create or replace function public.can_chat_as_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = (select auth.uid())
      and community_id = target_community_id
      and role in ('community_editor', 'community_admin')
      and status = 'active'
  )
  or (
    public.is_platform_admin()
    and exists (
      select 1 from public.communities
      where id = target_community_id and slug = 'igda-peru' and status = 'approved'
    )
  );
$$;

create or replace function public.can_accept_community_conversation(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = (select auth.uid())
      and community_id = target_community_id
      and role = 'community_admin'
      and status = 'active'
  )
  or (
    public.is_platform_admin()
    and exists (
      select 1 from public.communities
      where id = target_community_id and slug = 'igda-peru' and status = 'approved'
    )
  );
$$;

create or replace function public.can_access_community_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_conversation_id is not null and exists (
    select 1
    from public.community_conversations conversation
    where conversation.id = target_conversation_id
      and (
        public.can_chat_as_community(conversation.community_a_id)
        or public.can_chat_as_community(conversation.community_b_id)
      )
  );
$$;

create or replace function public.chat_conversation_id_from_topic(topic text)
returns uuid
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
begin
  return nullif(split_part(topic, ':', 2), '')::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

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
  conversation_id uuid;
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

  select id, status into conversation_id, current_status
  from public.community_conversations
  where community_a_id = first_community_id and community_b_id = second_community_id
  for update;

  if current_status = 'active' then raise exception 'Ya existe una conversación activa entre estas comunidades'; end if;
  if current_status = 'pending' then raise exception 'Ya existe una solicitud pendiente entre estas comunidades'; end if;

  if conversation_id is null then
    insert into public.community_conversations (
      community_a_id, community_b_id, requested_by_community_id, requested_by_user_id
    ) values (
      first_community_id, second_community_id, source_community_id, (select auth.uid())
    ) returning id into conversation_id;
  else
    update public.community_conversations
    set requested_by_community_id = source_community_id,
        requested_by_user_id = (select auth.uid()),
        status = 'pending',
        responded_by_user_id = null,
        responded_at = null,
        updated_at = now()
    where id = conversation_id;
  end if;

  insert into public.community_conversation_participants (conversation_id, community_id)
  values (conversation_id, source_community_id), (conversation_id, p_target_community_id)
  on conflict (conversation_id, community_id) do nothing;

  return conversation_id;
end;
$$;

create or replace function public.respond_community_conversation(
  p_conversation_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  conversation public.community_conversations%rowtype;
  destination_community_id uuid;
begin
  select * into conversation
  from public.community_conversations
  where id = p_conversation_id
  for update;
  if not found then raise exception 'Conversación no encontrada'; end if;
  if conversation.status <> 'pending' then raise exception 'La solicitud ya fue respondida'; end if;

  destination_community_id := case
    when conversation.requested_by_community_id = conversation.community_a_id then conversation.community_b_id
    else conversation.community_a_id
  end;
  if not public.can_accept_community_conversation(destination_community_id) then
    raise exception 'Solo un administrador de la comunidad destino puede responder';
  end if;

  update public.community_conversations
  set status = case when p_accept then 'active'::public.community_conversation_status else 'rejected'::public.community_conversation_status end,
      responded_by_user_id = (select auth.uid()),
      responded_at = now(),
      updated_at = now()
  where id = p_conversation_id;
end;
$$;

create or replace function public.list_community_conversations()
returns table (
  id uuid,
  status public.community_conversation_status,
  my_community_id uuid,
  my_community_name text,
  my_community_slug text,
  my_community_logo_path text,
  other_community_id uuid,
  other_community_name text,
  other_community_slug text,
  other_community_logo_path text,
  requested_by_community_id uuid,
  last_message_at timestamptz,
  last_message_body text,
  last_message_author_display_name text,
  unread_count bigint,
  archived_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    conversation.id,
    conversation.status,
    mine.community_id,
    mine_community.name,
    mine_community.slug,
    mine_community.logo_path,
    other_participant.community_id,
    other_community.name,
    other_community.slug,
    other_community.logo_path,
    conversation.requested_by_community_id,
    conversation.last_message_at,
    latest.body,
    latest.author_display_name,
    count(unread.id),
    mine.archived_at,
    conversation.created_at
  from public.community_conversations conversation
  join lateral (
    select participant.community_id, participant.last_read_at, participant.archived_at
    from public.community_conversation_participants participant
    where participant.conversation_id = conversation.id
      and public.can_chat_as_community(participant.community_id)
    order by participant.community_id
    limit 1
  ) mine on true
  join public.communities mine_community on mine_community.id = mine.community_id
  join public.community_conversation_participants other_participant
    on other_participant.conversation_id = conversation.id
   and other_participant.community_id <> mine.community_id
  join public.communities other_community on other_community.id = other_participant.community_id
  left join lateral (
    select message.body, message.author_display_name
    from public.community_messages message
    where message.conversation_id = conversation.id
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join public.community_messages unread
    on unread.conversation_id = conversation.id
   and unread.created_at > coalesce(mine.last_read_at, 'epoch'::timestamptz)
  where conversation.status in ('pending', 'active', 'rejected')
    and (
      mine.archived_at is null
      or conversation.last_message_at > mine.archived_at
      or conversation.status = 'pending'
    )
  group by conversation.id, mine.community_id, mine_community.name, mine_community.slug, mine_community.logo_path,
    other_participant.community_id, other_community.name, other_community.slug, other_community.logo_path,
    latest.body, latest.author_display_name, mine.last_read_at, mine.archived_at
  order by coalesce(conversation.last_message_at, conversation.created_at) desc;
$$;

create or replace function public.list_community_conversation_messages(
  p_conversation_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50
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
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select message.id, message.conversation_id, message.author_user_id, message.author_community_id,
    community.name, community.slug, community.logo_path, message.author_display_name, message.body, message.created_at
  from public.community_messages message
  join public.community_conversations conversation on conversation.id = message.conversation_id
  join public.communities community on community.id = message.author_community_id
  where message.conversation_id = p_conversation_id
    and conversation.status = 'active'
    and public.can_access_community_conversation(p_conversation_id)
    and (p_before is null or message.created_at < p_before)
  order by message.created_at desc, message.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
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

  select * into conversation from public.community_conversations where id = p_conversation_id;
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
  where id = p_conversation_id;

  update public.community_conversation_participants
  set archived_at = null
  where conversation_id = p_conversation_id and community_id = p_community_id;

  return query
  select inserted_message.id, inserted_message.conversation_id, inserted_message.author_user_id,
    inserted_message.author_community_id, community.name, community.slug, community.logo_path,
    inserted_message.author_display_name, inserted_message.body, inserted_message.created_at
  from public.communities community where community.id = inserted_message.author_community_id;
end;
$$;

create or replace function public.mark_community_conversation_read(
  p_conversation_id uuid,
  p_community_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_chat_as_community(p_community_id) or not public.can_access_community_conversation(p_conversation_id) then
    raise exception 'No tienes acceso a esta conversación';
  end if;
  update public.community_conversation_participants
  set last_read_at = now(), archived_at = null
  where conversation_id = p_conversation_id and community_id = p_community_id;
end;
$$;

create or replace function public.archive_community_conversation(
  p_conversation_id uuid,
  p_community_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_chat_as_community(p_community_id) or not public.can_access_community_conversation(p_conversation_id) then
    raise exception 'No tienes acceso a esta conversación';
  end if;
  update public.community_conversation_participants
  set archived_at = now()
  where conversation_id = p_conversation_id and community_id = p_community_id;
end;
$$;

alter table public.community_conversations enable row level security;
alter table public.community_conversation_participants enable row level security;
alter table public.community_messages enable row level security;

create policy community_conversations_read on public.community_conversations
for select to authenticated using (public.can_access_community_conversation(id));

create policy community_conversation_participants_read on public.community_conversation_participants
for select to authenticated using (public.can_access_community_conversation(conversation_id));

create policy community_messages_read on public.community_messages
for select to authenticated using (public.can_access_community_conversation(conversation_id));

create or replace function public.broadcast_community_message()
returns trigger
security definer
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform realtime.broadcast_changes(
    'community-conversation:' || new.conversation_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return new;
end;
$$;

drop trigger if exists community_messages_broadcast on public.community_messages;
create trigger community_messages_broadcast
after insert on public.community_messages
for each row execute function public.broadcast_community_message();

drop policy if exists community_chat_broadcast_read on realtime.messages;
create policy community_chat_broadcast_read on realtime.messages
for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and public.can_access_community_conversation(
    public.chat_conversation_id_from_topic((select realtime.topic()))
  )
);

drop policy if exists community_chat_broadcast_send on realtime.messages;
create policy community_chat_broadcast_send on realtime.messages
for insert to authenticated with check (
  realtime.messages.extension = 'broadcast'
  and public.can_access_community_conversation(
    public.chat_conversation_id_from_topic((select realtime.topic()))
  )
);

revoke all on function public.create_community_conversation(uuid, uuid) from public, anon;
revoke all on function public.respond_community_conversation(uuid, boolean) from public, anon;
revoke all on function public.list_community_conversations() from public, anon;
revoke all on function public.list_community_conversation_messages(uuid, timestamptz, integer) from public, anon;
revoke all on function public.send_community_message(uuid, uuid, text) from public, anon;
revoke all on function public.mark_community_conversation_read(uuid, uuid) from public, anon;
revoke all on function public.archive_community_conversation(uuid, uuid) from public, anon;

grant execute on function public.create_community_conversation(uuid, uuid) to authenticated;
grant execute on function public.respond_community_conversation(uuid, boolean) to authenticated;
grant execute on function public.list_community_conversations() to authenticated;
grant execute on function public.list_community_conversation_messages(uuid, timestamptz, integer) to authenticated;
grant execute on function public.send_community_message(uuid, uuid, text) to authenticated;
grant execute on function public.mark_community_conversation_read(uuid, uuid) to authenticated;
grant execute on function public.archive_community_conversation(uuid, uuid) to authenticated;
