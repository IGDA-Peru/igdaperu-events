create table public.event_collaborations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  partner_community_id uuid references public.communities(id) on delete cascade,
  external_name text,
  external_contact_url text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  conversation_id uuid references public.community_conversations(id) on delete set null,
  invited_by uuid references auth.users(id) on delete set null,
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_collaborations_partner_kind check (
    (partner_community_id is not null and external_name is null and external_contact_url is null)
    or
    (partner_community_id is null and external_name is not null and external_contact_url is not null)
  ),
  constraint event_collaborations_external_name check (
    external_name is null or char_length(btrim(external_name)) between 2 and 120
  ),
  constraint event_collaborations_external_url check (
    external_contact_url is null or external_contact_url ~* '^https?://[^[:space:]]+$'
  )
);

create unique index event_collaborations_registered_unique
  on public.event_collaborations (event_id, partner_community_id)
  where partner_community_id is not null;
create unique index event_collaborations_external_unique
  on public.event_collaborations (event_id, lower(external_name))
  where partner_community_id is null;
create index event_collaborations_conversation_idx
  on public.event_collaborations (conversation_id, created_at desc);

create trigger event_collaborations_set_updated_at
before update on public.event_collaborations
for each row execute function public.set_updated_at();

alter table public.community_messages
  add column message_kind text not null default 'text'
    check (message_kind in ('text', 'event_collaboration', 'event_collaboration_response')),
  add column event_collaboration_id uuid references public.event_collaborations(id) on delete set null;

create index community_messages_event_collaboration_idx
  on public.community_messages (event_collaboration_id)
  where event_collaboration_id is not null;

create or replace function public.can_manage_event_collaborators(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.events event
    where event.id = target_event_id
      and (
        (event.community_id is not null and public.has_community_role(event.community_id, array['community_editor', 'community_admin']::public.app_role[]))
        or public.is_platform_admin()
      )
  );
$$;

create or replace function public.event_collaboration_target_can_read(target_event_id uuid, target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_community_id is not null and public.can_chat_as_community(target_community_id)
  and exists (
    select 1 from public.event_collaborations collaboration
    where collaboration.event_id = target_event_id
      and collaboration.partner_community_id = target_community_id
  );
$$;

alter table public.event_collaborations enable row level security;

create policy event_collaborations_public_accepted_read
  on public.event_collaborations for select to anon, authenticated
  using (
    status = 'accepted'
    and exists (
      select 1 from public.events event
      where event.id = event_id
        and event.status in ('published', 'archived')
        and event.visibility = 'public'
        and (
          event.community_id is null
          or exists (
            select 1 from public.communities host
            where host.id = event.community_id and host.status = 'approved'
          )
        )
        and (
          partner_community_id is null
          or exists (
            select 1 from public.communities partner
            where partner.id = partner_community_id and partner.status = 'approved'
          )
        )
    )
  );

create policy event_collaborations_private_read
  on public.event_collaborations for select to authenticated
  using (
    public.can_manage_event_collaborators(event_id)
    or public.event_collaboration_target_can_read(event_id, partner_community_id)
  );

revoke all on public.event_collaborations from anon, authenticated;
grant select (id, event_id, partner_community_id, external_name, external_contact_url, status)
  on public.event_collaborations to anon, authenticated;

create or replace function public.sync_event_collaborators(
  p_event_id uuid,
  p_community_ids uuid[] default '{}'::uuid[],
  p_external_collaborators jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_row public.events%rowtype;
  target_community public.communities%rowtype;
  existing_collaboration public.event_collaborations%rowtype;
  collaboration_id uuid;
  conversation_id uuid;
  first_community_id uuid;
  second_community_id uuid;
  inserted_message public.community_messages%rowtype;
  external_row record;
  display_name text;
  requested_community_ids uuid[] := coalesce(p_community_ids, '{}'::uuid[]);
  external_payload jsonb := coalesce(p_external_collaborators, '[]'::jsonb);
begin
  select * into event_row from public.events where id = p_event_id for update;
  if not found then raise exception 'Evento no encontrado'; end if;
  if not public.can_manage_event_collaborators(p_event_id) then
    raise exception 'No tienes permisos para administrar las colaboraciones de este evento';
  end if;
  if event_row.community_id is null and cardinality(requested_community_ids) > 0 then
    raise exception 'Los eventos independientes no pueden invitar comunidades de la plataforma';
  end if;
  if jsonb_typeof(external_payload) <> 'array' then
    raise exception 'La lista de colaboradores externos no es válida';
  end if;
  if (
    select count(*) from jsonb_to_recordset(external_payload) as item(name text, contact_url text)
  ) <> (
    select count(distinct lower(btrim(item.name))) from jsonb_to_recordset(external_payload) as item(name text, contact_url text)
  ) then
    raise exception 'No puedes repetir el nombre de un colaborador externo';
  end if;

  for external_row in
    select item.name, item.contact_url
    from jsonb_to_recordset(external_payload) as item(name text, contact_url text)
  loop
    if char_length(btrim(coalesce(external_row.name, ''))) not between 2 and 120 then
      raise exception 'El nombre del colaborador externo debe tener entre 2 y 120 caracteres';
    end if;
    if coalesce(external_row.contact_url, '') !~* '^https?://[^[:space:]]+$' then
      raise exception 'El enlace de contacto externo debe comenzar con http:// o https://';
    end if;
  end loop;

  if cardinality(requested_community_ids) <> (select count(distinct id) from unnest(requested_community_ids) as selected(id)) then
    raise exception 'No puedes repetir una comunidad colaboradora';
  end if;

  delete from public.event_collaborations collaboration
  where collaboration.event_id = p_event_id
    and collaboration.partner_community_id is not null
    and not (collaboration.partner_community_id = any(requested_community_ids));

  delete from public.event_collaborations collaboration
  where collaboration.event_id = p_event_id
    and collaboration.partner_community_id is null
    and not exists (
      select 1
      from jsonb_to_recordset(external_payload) as item(name text, contact_url text)
      where lower(btrim(item.name)) = lower(collaboration.external_name)
    );

  for target_community in
    select community.*
    from public.communities community
    where community.id = any(requested_community_ids)
      and community.status = 'approved'
  loop
    if target_community.id = event_row.community_id then
      raise exception 'La comunidad anfitriona no puede colaborar consigo misma';
    end if;

    select * into existing_collaboration
    from public.event_collaborations collaboration
    where collaboration.event_id = p_event_id
      and collaboration.partner_community_id = target_community.id
    for update;

    if found then continue; end if;
    if not public.can_chat_as_community(event_row.community_id) then
      raise exception 'Solo puedes enviar invitaciones desde una comunidad que representas en las conversaciones';
    end if;

    first_community_id := least(event_row.community_id, target_community.id);
    second_community_id := greatest(event_row.community_id, target_community.id);

    insert into public.community_conversations (
      community_a_id, community_b_id, requested_by_community_id, requested_by_user_id,
      status, responded_by_user_id, responded_at, last_message_at
    ) values (
      first_community_id, second_community_id, event_row.community_id, (select auth.uid()),
      'pending', null, null, null
    )
    on conflict (community_a_id, community_b_id) do update
    set requested_by_community_id = case
          when public.community_conversations.status = 'active' then public.community_conversations.requested_by_community_id
          else excluded.requested_by_community_id
        end,
        requested_by_user_id = case
          when public.community_conversations.status = 'active' then public.community_conversations.requested_by_user_id
          else excluded.requested_by_user_id
        end,
        status = case
          when public.community_conversations.status = 'active' then 'active'::public.community_conversation_status
          else 'pending'::public.community_conversation_status
        end,
        responded_by_user_id = case
          when public.community_conversations.status = 'active' then public.community_conversations.responded_by_user_id
          else null
        end,
        responded_at = case
          when public.community_conversations.status = 'active' then public.community_conversations.responded_at
          else null
        end,
        updated_at = now()
    returning id into conversation_id;

    insert into public.community_conversation_participants (conversation_id, community_id)
    values (conversation_id, event_row.community_id), (conversation_id, target_community.id)
    on conflict (conversation_id, community_id) do update set archived_at = null;

    insert into public.event_collaborations (
      event_id, partner_community_id, status, conversation_id, invited_by
    ) values (
      p_event_id, target_community.id, 'pending', conversation_id, (select auth.uid())
    ) returning id into collaboration_id;

    select coalesce(nullif(trim(profile.display_name), ''), 'Miembro de la comunidad')
    into display_name from public.profiles profile where profile.id = (select auth.uid());
    insert into public.community_messages (
      conversation_id, author_user_id, author_community_id, author_display_name,
      body, message_kind, event_collaboration_id
    ) values (
      conversation_id, (select auth.uid()), event_row.community_id,
      coalesce(display_name, 'Miembro de la comunidad'),
      'Te invitamos a colaborar en «' || event_row.title || '».',
      'event_collaboration', collaboration_id
    ) returning * into inserted_message;

    update public.community_conversations
    set last_message_at = inserted_message.created_at, updated_at = now()
    where id = conversation_id;
  end loop;

  if cardinality(requested_community_ids) > (
    select count(*) from public.communities community
    where community.id = any(requested_community_ids) and community.status = 'approved'
  ) then
    raise exception 'Selecciona solo comunidades aprobadas disponibles';
  end if;

  insert into public.event_collaborations (
    event_id, external_name, external_contact_url, status, invited_by
  )
  select p_event_id, btrim(item.name), btrim(item.contact_url), 'accepted', (select auth.uid())
  from jsonb_to_recordset(external_payload) as item(name text, contact_url text)
  on conflict (event_id, lower(external_name)) where partner_community_id is null
  do update set external_contact_url = excluded.external_contact_url, status = 'accepted';
end;
$$;

create or replace function public.respond_to_event_collaboration(
  p_collaboration_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  collaboration public.event_collaborations%rowtype;
  event_row public.events%rowtype;
  conversation public.community_conversations%rowtype;
  profile_name text;
  response_text text;
begin
  select * into collaboration
  from public.event_collaborations
  where id = p_collaboration_id
  for update;
  if not found or collaboration.partner_community_id is null then
    raise exception 'Invitación de colaboración no encontrada';
  end if;
  if collaboration.status <> 'pending' then
    raise exception 'La invitación ya fue respondida';
  end if;
  if not public.can_accept_community_conversation(collaboration.partner_community_id) then
    raise exception 'Solo un administrador de la comunidad destino puede responder';
  end if;

  update public.event_collaborations
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_by = (select auth.uid()),
      responded_at = now()
  where id = p_collaboration_id;

  select * into event_row from public.events where id = collaboration.event_id;
  if collaboration.conversation_id is not null then
    select * into conversation from public.community_conversations where id = collaboration.conversation_id for update;
    if found and conversation.status in ('pending', 'rejected') then
      update public.community_conversations
      set status = case when p_accept then 'active'::public.community_conversation_status else 'rejected'::public.community_conversation_status end,
          responded_by_user_id = (select auth.uid()),
          responded_at = now(),
          updated_at = now()
      where id = collaboration.conversation_id;
    end if;

    select coalesce(nullif(trim(profile.display_name), ''), 'Miembro de la comunidad')
    into profile_name from public.profiles profile where profile.id = (select auth.uid());
    response_text := case when p_accept then 'Aceptó' else 'Rechazó' end
      || ' la invitación para colaborar en «' || event_row.title || '».';
    insert into public.community_messages (
      conversation_id, author_user_id, author_community_id, author_display_name,
      body, message_kind, event_collaboration_id
    ) values (
      collaboration.conversation_id, (select auth.uid()), collaboration.partner_community_id,
      coalesce(profile_name, 'Miembro de la comunidad'), response_text,
      'event_collaboration_response', p_collaboration_id
    );

    update public.community_conversations
    set last_message_at = now(), updated_at = now()
    where id = collaboration.conversation_id;
    update public.community_conversation_participants
    set archived_at = null
    where conversation_id = collaboration.conversation_id
      and community_id = collaboration.partner_community_id;
  end if;
end;
$$;

drop function public.list_community_conversation_messages(uuid, timestamptz, integer);

create function public.list_community_conversation_messages(
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
  created_at timestamptz,
  message_kind text,
  event_collaboration_id uuid,
  event_id uuid,
  event_title text,
  event_slug text,
  collaboration_status text,
  host_community_name text,
  partner_community_id uuid,
  event_starts_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select message.id, message.conversation_id, message.author_user_id, message.author_community_id,
    author_community.name, author_community.slug, author_community.logo_path,
    message.author_display_name, message.body, message.created_at, message.message_kind,
    collaboration.id, event.id, event.title, event.slug, collaboration.status,
    host_community.name, collaboration.partner_community_id, event.starts_at
  from public.community_messages message
  join public.community_conversations conversation on conversation.id = message.conversation_id
  join public.communities author_community on author_community.id = message.author_community_id
  left join public.event_collaborations collaboration on collaboration.id = message.event_collaboration_id
  left join public.events event on event.id = collaboration.event_id
  left join public.communities host_community on host_community.id = event.community_id
  where message.conversation_id = p_conversation_id
    and public.can_access_community_conversation(p_conversation_id)
    and (
      conversation.status = 'active'
      or message.message_kind in ('event_collaboration', 'event_collaboration_response')
    )
    and (p_before is null or message.created_at < p_before)
  order by message.created_at desc, message.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$$;

revoke all on function public.list_community_conversation_messages(uuid, timestamptz, integer) from public, anon;
grant execute on function public.list_community_conversation_messages(uuid, timestamptz, integer) to authenticated;

revoke all on function public.can_manage_event_collaborators(uuid) from public, anon;
revoke all on function public.event_collaboration_target_can_read(uuid, uuid) from public, anon;
revoke all on function public.sync_event_collaborators(uuid, uuid[], jsonb) from public, anon;
revoke all on function public.respond_to_event_collaboration(uuid, boolean) from public, anon;
grant execute on function public.can_manage_event_collaborators(uuid) to authenticated;
grant execute on function public.event_collaboration_target_can_read(uuid, uuid) to authenticated;
grant execute on function public.sync_event_collaborators(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.respond_to_event_collaboration(uuid, boolean) to authenticated;
