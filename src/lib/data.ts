import { demoCommunities, demoConversations, demoEvents, demoMessages } from './demo-data'
import { isSupabaseConfigured, supabase } from './supabase'
import { eventIntervalsOverlap } from './eventConflicts'
import type { ChatIdentity, ChatMessage, Community, CommunityConversation, CommunityMember, CommunityMemberEmail, CommunitySyncResult, EventConflict, EventInput, EventItem, EventReport, GoogleCalendarSyncResult, Membership, Profile, Role } from '../types'
import { isEventPast } from './format'

export type EventQueryOptions = { communitySlug?: string; search?: string; network?: boolean; upcomingOnly?: boolean; limit?: number }

const mapCommunity = (row: any): Community => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description || '',
  logoPath: row.logo_path,
  websiteUrl: row.website_url,
  discordUrl: row.discord_url,
  status: row.status,
})

const mapEvent = (row: any): EventItem => {
  const community = Array.isArray(row.community) ? row.community[0] : row.community
  return {
    id: row.id,
    slug: row.slug,
    communityId: row.community_id,
    communityName: community?.name || 'Comunidad',
    communitySlug: community?.slug || '',
    communityLogoPath: community?.logo_path,
    creatorEmail: row.creator_email || null,
    title: row.title,
    description: row.description || '',
    type: row.type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAllDay: Boolean(row.is_all_day),
    timezone: row.timezone || 'America/Lima',
    locationType: row.location_type,
    venueName: row.venue_name,
    address: row.address,
    mapUrl: row.map_url,
    placeId: row.place_id,
    formattedAddress: row.formatted_address,
    latitude: row.latitude,
    longitude: row.longitude,
    meetingUrl: row.meeting_url,
    meetingProvider: row.meeting_provider || 'other',
    coverPath: row.cover_path,
    visibility: row.visibility,
    status: row.status,
  }
}

const mapChatIdentity = (row: any, prefix = ''): ChatIdentity => ({
  communityId: row[`${prefix}community_id`],
  communityName: row[`${prefix}community_name`] || 'Comunidad',
  communitySlug: row[`${prefix}community_slug`] || '',
  communityLogoPath: row[`${prefix}community_logo_path`] || null,
})

const mapConversation = (row: any): CommunityConversation => ({
  id: row.id,
  status: row.status,
  myCommunity: mapChatIdentity(row, 'my_'),
  otherCommunity: mapChatIdentity(row, 'other_'),
  requestedByCommunityId: row.requested_by_community_id,
  lastMessageAt: row.last_message_at,
  lastMessageBody: row.last_message_body,
  lastMessageAuthorDisplayName: row.last_message_author_display_name,
  unreadCount: Number(row.unread_count || 0),
  archivedAt: row.archived_at,
  createdAt: row.created_at,
})

const mapChatMessage = (row: any): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  authorUserId: row.author_user_id,
  authorCommunity: mapChatIdentity(row, 'author_'),
  authorDisplayName: row.author_display_name || 'Miembro de la comunidad',
  body: row.body,
  createdAt: row.created_at,
})

export async function listCommunities(includeUnapproved = false): Promise<Community[]> {
  if (!isSupabaseConfigured || !supabase) return demoCommunities
  let query = supabase.from('communities').select('*').order('name')
  if (!includeUnapproved) query = query.eq('status', 'approved')
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapCommunity)
}

export function getCommunityLogoUrl(path?: string | null) {
  if (!path) return null
  if (path.startsWith('/') || /^https?:\/\//i.test(path) || path.startsWith('blob:')) return path
  return supabase?.storage.from('community-assets').getPublicUrl(path).data.publicUrl || null
}

export function getEventCoverUrl(path?: string | null) {
  if (!path) return null
  if (path.startsWith('/') || /^https?:\/\//i.test(path) || path.startsWith('blob:')) return path
  return supabase?.storage.from('event-assets').getPublicUrl(path).data.publicUrl || null
}

export async function uploadCommunityLogo(communityId: string, file: File, previousPath?: string | null) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('El logo debe estar en formato JPG, PNG o WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('El logo no puede superar los 5 MB.')
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'
  const path = `${communityId}/logo-${crypto.randomUUID()}.${extension}`
  const storage = supabase.storage.from('community-assets')
  const { error: uploadError } = await storage.upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error: updateError } = await supabase.from('communities').update({ logo_path: path }).eq('id', communityId)
  if (updateError) {
    await storage.remove([path])
    throw updateError
  }
  if (previousPath && !previousPath.startsWith('/') && !/^https?:\/\//i.test(previousPath)) await storage.remove([previousPath])
  return path
}

export async function uploadEventBanner(eventId: string, file: File, previousPath?: string | null) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('El banner debe estar en formato JPG, PNG o WebP.')
  if (file.size > 8 * 1024 * 1024) throw new Error('El banner no puede superar los 8 MB.')
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'
  const path = `${eventId}/banner-${crypto.randomUUID()}.${extension}`
  const storage = supabase.storage.from('event-assets')
  const { error: uploadError } = await storage.upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error: updateError } = await supabase.from('events').update({ cover_path: path }).eq('id', eventId)
  if (updateError) {
    await storage.remove([path])
    throw updateError
  }
  if (previousPath && !previousPath.startsWith('/') && !/^https?:\/\//i.test(previousPath)) await storage.remove([previousPath])
  return path
}

export async function listEvents(options: EventQueryOptions = {}): Promise<EventItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    const query = options.search?.trim().toLowerCase()
    const events = demoEvents.filter((event) => {
      const matchesCommunity = !options.communitySlug || event.communitySlug === options.communitySlug
      const matchesSearch = !query || `${event.title} ${event.description} ${event.communityName}`.toLowerCase().includes(query)
      const matchesVisibility = options.network || event.visibility === 'public'
      const matchesUpcoming = !options.upcomingOnly || Boolean(event.startsAt && new Date(event.startsAt).getTime() >= Date.now())
      return matchesCommunity && matchesSearch && matchesVisibility && matchesUpcoming
    })
    events.sort((first, second) => {
      if (!first.startsAt && !second.startsAt) return 0
      if (!first.startsAt) return 1
      if (!second.startsAt) return -1
      const firstPast = isEventPast(first)
      const secondPast = isEventPast(second)
      if (firstPast !== secondPast) return firstPast ? 1 : -1
      return new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    })
    return options.limit ? events.slice(0, options.limit) : events
  }

  const select = options.upcomingOnly || options.limit
    ? 'id,slug,community_id,title,description,type,starts_at,ends_at,is_all_day,timezone,location_type,venue_name,address,map_url,formatted_address,meeting_url,meeting_provider,cover_path,visibility,status,community:communities!inner(name,slug,status,logo_path)'
    : '*, community:communities!inner(name,slug,status,logo_path)'
  let query = supabase
    .from('events')
    .select(select)
    .in('status', ['published', 'archived'])
    .order('starts_at', { ascending: true })
    .limit(options.limit || 50)

  if (!options.network) query = query.eq('visibility', 'public')
  if (options.communitySlug) query = query.eq('community.slug', options.communitySlug)
  if (options.search?.trim()) query = query.ilike('title', `%${options.search.trim()}%`)
  if (options.upcomingOnly) query = query.gte('starts_at', new Date().toISOString())

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapEvent).sort((first, second) => {
    if (!first.startsAt && !second.startsAt) return 0
    if (!first.startsAt) return 1
    if (!second.startsAt) return -1
    const firstPast = isEventPast(first)
    const secondPast = isEventPast(second)
    if (firstPast !== secondPast) return firstPast ? 1 : -1
    const difference = new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    return firstPast ? -difference : difference
  })
}

export async function listHomeEmbedEvents(communitySlug?: string): Promise<EventItem[]> {
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'

  if (!import.meta.env.PROD || localHost) return listEvents({ communitySlug, upcomingOnly: true, limit: 3 })

  const endpoint = new URL('/api/home-events', window.location.origin)
  if (communitySlug) endpoint.searchParams.set('community', communitySlug)
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error('No pudimos cargar los próximos eventos.')
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('La respuesta de eventos no es válida.')
  return data.map(mapEvent)
}

export async function listCommunityEvents(): Promise<EventItem[]> {
  return listEvents({ network: true })
}

export async function listEventConflicts(startsAt: string, endsAt: string, excludeEventId?: string): Promise<{ conflicts: EventConflict[]; hasMore: boolean }> {
  if (!startsAt || !endsAt) return { conflicts: [], hasMore: false }

  if (!isSupabaseConfigured || !supabase) {
    const matching = demoEvents
      .filter((event) => event.status === 'published' && eventIntervalsOverlap(startsAt, endsAt, event.startsAt || '', event.endsAt || '') && event.id !== excludeEventId)
      .sort((first, second) => new Date(first.startsAt || 0).getTime() - new Date(second.startsAt || 0).getTime())
    return {
      conflicts: matching.slice(0, 3).map((event) => ({ id: event.id, title: event.title, communityName: event.communityName, startsAt: event.startsAt as string, endsAt: event.endsAt as string, isAllDay: event.isAllDay })),
      hasMore: matching.length > 3,
    }
  }

  let query = supabase
    .from('events')
    .select('id,title,starts_at,ends_at,is_all_day,community:communities!inner(name,status)')
    .eq('status', 'published')
    .in('visibility', ['public', 'network'])
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)
    .eq('community.status', 'approved')
    .order('starts_at', { ascending: true })
    .limit(4)
  if (excludeEventId) query = query.neq('id', excludeEventId)

  const { data, error } = await query
  if (error) throw error
  const rows = (data || []).map((row: any) => {
    const community = Array.isArray(row.community) ? row.community[0] : row.community
    return { id: row.id, title: row.title, communityName: community?.name || 'Comunidad', startsAt: row.starts_at, endsAt: row.ends_at, isAllDay: Boolean(row.is_all_day) } as EventConflict
  })
  return { conflicts: rows.slice(0, 3), hasMore: rows.length > 3 }
}

export async function getEventBySlug(slug: string, network = false): Promise<EventItem | null> {
  if (!isSupabaseConfigured || !supabase) return demoEvents.find((event) => event.slug === slug) || null
  let query = supabase.from('events').select('*, community:communities!inner(name,slug,status,logo_path)').eq('slug', slug)
  if (!network) query = query.eq('visibility', 'public')
  query = query.in('status', ['published', 'archived'])
  const singleQuery = query.maybeSingle()
  const { data, error } = await singleQuery
  if (error) throw error
  return data ? mapEvent(data) : null
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const firstName = data.first_name || ''
  const lastName = data.last_name || ''
  return {
    id: data.id,
    displayName: data.display_name || [firstName, lastName].filter(Boolean).join(' '),
    firstName,
    lastName,
    avatarPath: data.avatar_path,
  }
}

export async function getMemberships(userId: string): Promise<Membership[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('memberships').select('community_id,role,status,community:communities(name,slug,logo_path)').eq('user_id', userId).eq('status', 'active')
  if (error) throw error
  return (data || []).map((row: any) => {
    const community = Array.isArray(row.community) ? row.community[0] : row.community
    return { communityId: row.community_id, communityName: community?.name || '', communitySlug: community?.slug || '', communityLogoPath: community?.logo_path, role: row.role as Role, status: row.status }
  })
}

export async function listCommunityMemberEmails(communityId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_community_member_emails', { p_community_id: communityId })
  if (error) throw error
  return (data || []).map((row: CommunityMemberEmail) => row.email).filter(Boolean)
}

export async function listCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_community_members', { p_community_id: communityId })
  if (error) throw error
  return (data || []).map((row: any) => ({
    membershipId: row.membership_id || null,
    invitationId: row.invitation_id || null,
    email: row.email,
    role: row.role as Role,
    status: row.status as CommunityMember['status'],
  }))
}

export async function updateProfileIdentity(userId: string, firstName: string, lastName: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const normalizedFirstName = firstName.trim()
  const normalizedLastName = lastName.trim()
  const { error } = await supabase.from('profiles').update({
    first_name: normalizedFirstName,
    last_name: normalizedLastName,
    display_name: [normalizedFirstName, normalizedLastName].filter(Boolean).join(' '),
  }).eq('id', userId)
  if (error) throw error
}

export async function revokeCommunityMember(membershipId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.rpc('revoke_community_member', { p_membership_id: membershipId })
  if (error) throw error
}

export async function cancelCommunityInvitation(invitationId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.rpc('cancel_community_invitation', { p_invitation_id: invitationId })
  if (error) throw error
}

export async function listManagedEvents(communityIds: string[], allCommunities = false): Promise<EventItem[]> {
  if (!supabase || (!communityIds.length && !allCommunities)) return []
  let query = supabase.from('events').select('*, community:communities!inner(name,slug,status,logo_path)').order('starts_at', { ascending: true }).limit(100)
  if (!allCommunities && communityIds.length) query = query.in('community_id', communityIds)
  const { data, error } = await query
  if (error) throw error
  const events = (data || []).map(mapEvent)
  if (!events.length) return events

  const { data: creatorRows, error: creatorError } = await supabase.rpc('list_event_creator_emails', {
    p_event_ids: events.map((event) => event.id),
  })
  if (creatorError) throw creatorError
  const creatorEmails = new Map<string, string | null>((creatorRows || []).map((row: { event_id: string; email: string | null }) => [row.event_id, row.email]))
  return events.map((event) => ({ ...event, creatorEmail: creatorEmails.get(event.id) || null }))
}

export async function listConversations(): Promise<CommunityConversation[]> {
  if (!supabase) return demoConversations
  const { data, error } = await supabase.rpc('list_community_conversations')
  if (error) throw error
  return (data || []).map(mapConversation)
}

export async function getConversationMessages(conversationId: string, before?: string | null): Promise<ChatMessage[]> {
  if (!supabase) return [...(demoMessages[conversationId] || [])].sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
  const { data, error } = await supabase.rpc('list_community_conversation_messages', {
    p_conversation_id: conversationId,
    p_before: before || null,
    p_limit: 50,
  })
  if (error) throw error
  return (data || []).map(mapChatMessage).reverse()
}

export async function createConversation(targetCommunityId: string, sourceCommunityId?: string | null): Promise<string> {
  if (!supabase) {
    const source = sourceCommunityId || 'igda-peru'
    const target = demoConversations.find((conversation) => conversation.otherCommunity.communityId === targetCommunityId)?.otherCommunity || { communityId: targetCommunityId, communityName: 'Nueva comunidad', communitySlug: targetCommunityId }
    const id = `demo-conversation-${crypto.randomUUID()}`
    demoConversations.unshift({ id, status: 'pending', myCommunity: { communityId: source, communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png' }, otherCommunity: target, requestedByCommunityId: source, lastMessageAt: null, lastMessageBody: null, lastMessageAuthorDisplayName: null, unreadCount: 0, archivedAt: null, createdAt: new Date().toISOString() })
    demoMessages[id] = []
    return id
  }
  const { data, error } = await supabase.rpc('create_community_conversation', { p_target_community_id: targetCommunityId, p_source_community_id: sourceCommunityId || null })
  if (error) throw error
  return String(data)
}

export async function respondToConversation(conversationId: string, accept: boolean) {
  if (!supabase) {
    const conversation = demoConversations.find((item) => item.id === conversationId)
    if (conversation) conversation.status = accept ? 'active' : 'rejected'
    return
  }
  const { error } = await supabase.rpc('respond_community_conversation', { p_conversation_id: conversationId, p_accept: accept })
  if (error) throw error
}

export async function sendMessage(conversationId: string, communityId: string, body: string): Promise<ChatMessage> {
  if (!supabase) {
    const now = new Date().toISOString()
    const message: ChatMessage = { id: `demo-message-${crypto.randomUUID()}`, conversationId, authorUserId: 'demo-user', authorCommunity: { communityId, communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png' }, authorDisplayName: 'Tú', body: body.trim(), createdAt: now }
    demoMessages[conversationId] = [...(demoMessages[conversationId] || []), message]
    const conversation = demoConversations.find((item) => item.id === conversationId)
    if (conversation) { conversation.lastMessageAt = now; conversation.lastMessageBody = message.body; conversation.lastMessageAuthorDisplayName = message.authorDisplayName }
    return message
  }
  const { data, error } = await supabase.rpc('send_community_message', { p_conversation_id: conversationId, p_community_id: communityId, p_body: body })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('El mensaje no fue creado.')
  return mapChatMessage(row)
}

export async function markConversationRead(conversationId: string, communityId: string) {
  if (!supabase) {
    const conversation = demoConversations.find((item) => item.id === conversationId)
    if (conversation && conversation.myCommunity.communityId === communityId) conversation.unreadCount = 0
    return
  }
  const { error } = await supabase.rpc('mark_community_conversation_read', { p_conversation_id: conversationId, p_community_id: communityId })
  if (error) throw error
}

export async function archiveConversation(conversationId: string, communityId: string) {
  if (!supabase) {
    const conversation = demoConversations.find((item) => item.id === conversationId)
    if (conversation && conversation.myCommunity.communityId === communityId) conversation.archivedAt = new Date().toISOString()
    return
  }
  const { error } = await supabase.rpc('archive_community_conversation', { p_conversation_id: conversationId, p_community_id: communityId })
  if (error) throw error
}

export async function saveEvent(input: EventInput, eventId?: string): Promise<EventItem> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const payload = {
    community_id: input.communityId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    type: input.type,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    is_all_day: input.isAllDay,
    timezone: 'America/Lima',
    location_type: input.locationType,
    venue_name: input.venueName || null,
    address: input.address || null,
    map_url: input.mapUrl || null,
    place_id: input.placeId || null,
    formatted_address: input.formattedAddress || null,
    latitude: input.latitude,
    longitude: input.longitude,
    meeting_url: input.meetingUrl || null,
    meeting_provider: input.meetingProvider,
    cover_path: input.coverPath || null,
    visibility: input.visibility,
    status: input.status,
  }
  const request = eventId ? supabase.from('events').update(payload).eq('id', eventId) : supabase.from('events').insert(payload)
  const { data, error } = await request.select('*, community:communities!inner(name,slug,status,logo_path)').single()
  if (error) throw error
  return mapEvent(data)
}

export async function archiveEvent(eventId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('events').update({ status: 'archived' }).eq('id', eventId)
  if (error) throw error
}

export async function deleteEvent(eventId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export async function updateCommunityStatus(communityId: string, status: 'approved' | 'suspended') {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('communities').update({ status }).eq('id', communityId)
  if (error) throw error
}

export async function createCommunity(name: string, slug: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.from('communities').insert({ name, slug, status: 'pending' }).select().single()
  if (error) throw error
  return mapCommunity(data)
}

export async function updateCommunity(communityId: string, values: { description: string; websiteUrl?: string; discordUrl?: string }) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.from('communities').update({ description: values.description, website_url: values.websiteUrl || null, discord_url: values.discordUrl || null }).eq('id', communityId).select().single()
  if (error) throw error
  return mapCommunity(data)
}

export async function createEventReport(eventId: string, reason: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('event_reports').insert({ event_id: eventId, reason })
  if (error) throw error
}

export async function listEventReports(): Promise<EventReport[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('event_reports').select('id,event_id,reason,created_at,resolved_at,event:events(title,slug)').is('resolved_at', null).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((row: any) => {
    const event = Array.isArray(row.event) ? row.event[0] : row.event
    return { id: row.id, eventId: row.event_id, eventTitle: event?.title || 'Evento eliminado', eventSlug: event?.slug || '', reason: row.reason, createdAt: row.created_at, resolvedAt: row.resolved_at }
  })
}

export async function resolveEventReport(reportId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('event_reports').update({ resolved_at: new Date().toISOString() }).eq('id', reportId)
  if (error) throw error
}

export async function syncCommunitiesFromSheet(): Promise<CommunitySyncResult> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('sync-communities', { body: {} })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const details = await context.json() as { error?: string; stage?: string }
        if (details.error) throw new Error(details.stage ? `${details.error} (etapa: ${details.stage})` : details.error)
      } catch (reason: unknown) {
        if (reason instanceof Error && reason.message !== error.message) throw reason
      }
    }
    throw error
  }
  if (!data || typeof data !== 'object' || !data.runId) throw new Error('La sincronización devolvió una respuesta inválida.')
  return data as CommunitySyncResult
}

export async function syncEventsToGoogleCalendar(): Promise<GoogleCalendarSyncResult> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) throw new Error('Tu sesión no está activa. Vuelve a ingresar como administrador de IGDA e inténtalo nuevamente.')
  const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
    body: {},
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const details = await context.json() as { error?: string; stage?: string }
        if (details.error) throw new Error(details.stage ? `${details.error} (etapa: ${details.stage})` : details.error)
      } catch (reason: unknown) {
        if (reason instanceof Error && reason.message !== error.message) throw reason
      }
    }
    throw error
  }
  if (!data || typeof data !== 'object' || typeof data.calendarId !== 'string') throw new Error('La sincronización de Google Calendar devolvió una respuesta inválida.')
  return data as GoogleCalendarSyncResult
}

export type GoogleMeetConnectionStatus = {
  connected: boolean
  email: string | null
  status: 'active' | 'revoked' | 'error' | null
}

async function invokeFunctionError(error: unknown) {
  const context = (error as { context?: Response }).context
  if (context) {
    try {
      const details = await context.clone().json() as { error?: string }
      if (details.error) return new Error(details.error)
    } catch {
      // Conserva el error original cuando la respuesta no es JSON.
    }
  }
  return error instanceof Error ? error : new Error('La función no pudo completar la solicitud.')
}

async function invokeAuthorizedFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) throw new Error('Tu sesión no está activa. Vuelve a ingresar e inténtalo nuevamente.')
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  })
  if (error) throw await invokeFunctionError(error)
  return data as T
}

export async function getGoogleMeetConnection(communityId: string): Promise<GoogleMeetConnectionStatus> {
  return invokeAuthorizedFunction<GoogleMeetConnectionStatus>('google-meet-oauth', { action: 'status', communityId })
}

export async function startGoogleMeetConnection(communityId: string, returnPath: string): Promise<string> {
  const result = await invokeAuthorizedFunction<{ authorizationUrl?: string }>('google-meet-oauth', { communityId, returnPath })
  if (!result.authorizationUrl) throw new Error('Google no devolvió la URL de autorización.')
  return result.authorizationUrl
}

export async function createGoogleMeetLink(eventId: string): Promise<{ meetingUrl: string; provider: 'google_meet'; googleEmail: string; reused: boolean }> {
  return invokeAuthorizedFunction('google-meet-create', { eventId })
}
