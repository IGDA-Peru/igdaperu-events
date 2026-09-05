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
    order by
      case when conversation.status = 'pending'
        and participant.community_id <> conversation.requested_by_community_id then 0 else 1 end,
      participant.community_id
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
      or coalesce(conversation.last_message_at, conversation.created_at) > mine.archived_at
    )
  group by conversation.id, mine.community_id, mine_community.name, mine_community.slug, mine_community.logo_path,
    other_participant.community_id, other_community.name, other_community.slug, other_community.logo_path,
    latest.body, latest.author_display_name, mine.last_read_at, mine.archived_at
  order by coalesce(conversation.last_message_at, conversation.created_at) desc;
$$;
