import { demoCommunities, demoEvents } from './demo-data'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Community, CommunitySyncResult, EventInput, EventItem, EventReport, Membership, Profile, Role } from '../types'
import { isEventPast } from './format'

type EventQueryOptions = { communitySlug?: string; search?: string; network?: boolean }

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
    title: row.title,
    description: row.description || '',
    type: row.type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone || 'America/Lima',
    locationType: row.location_type,
    venueName: row.venue_name,
    address: row.address,
    mapUrl: row.map_url,
    meetingUrl: row.meeting_url,
    meetingProvider: row.meeting_provider || 'other',
    coverPath: row.cover_path,
    visibility: row.visibility,
    status: row.status,
  }
}

export async function listCommunities(includeUnapproved = false): Promise<Community[]> {
  if (!isSupabaseConfigured || !supabase) return demoCommunities
  let query = supabase.from('communities').select('*').order('name')
  if (!includeUnapproved) query = query.eq('status', 'approved')
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapCommunity)
}

export async function listEvents(options: EventQueryOptions = {}): Promise<EventItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    const query = options.search?.trim().toLowerCase()
    return demoEvents.filter((event) => {
      const matchesCommunity = !options.communitySlug || event.communitySlug === options.communitySlug
      const matchesSearch = !query || `${event.title} ${event.description} ${event.communityName}`.toLowerCase().includes(query)
      const matchesVisibility = options.network || event.visibility === 'public'
      return matchesCommunity && matchesSearch && matchesVisibility
    })
  }

  let query = supabase
    .from('events')
    .select('*, community:communities!inner(name,slug,status)')
    .in('status', ['published', 'archived'])
    .order('starts_at', { ascending: true })
    .limit(50)

  if (!options.network) query = query.eq('visibility', 'public')
  if (options.communitySlug) query = query.eq('community.slug', options.communitySlug)
  if (options.search?.trim()) query = query.ilike('title', `%${options.search.trim()}%`)

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapEvent).sort((first, second) => {
    const firstPast = isEventPast(first)
    const secondPast = isEventPast(second)
    if (firstPast !== secondPast) return firstPast ? 1 : -1
    const difference = new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    return firstPast ? -difference : difference
  })
}

export async function getEventBySlug(slug: string, network = false): Promise<EventItem | null> {
  if (!isSupabaseConfigured || !supabase) return demoEvents.find((event) => event.slug === slug) || null
  let query = supabase.from('events').select('*, community:communities!inner(name,slug,status)').eq('slug', slug)
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
  return data ? { id: data.id, displayName: data.display_name || '', avatarPath: data.avatar_path } : null
}

export async function getMemberships(userId: string): Promise<Membership[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('memberships').select('community_id,role,status,community:communities(name,slug)').eq('user_id', userId).eq('status', 'active')
  if (error) throw error
  return (data || []).map((row: any) => {
    const community = Array.isArray(row.community) ? row.community[0] : row.community
    return { communityId: row.community_id, communityName: community?.name || '', communitySlug: community?.slug || '', role: row.role as Role, status: row.status }
  })
}

export async function listManagedEvents(communityIds: string[], allCommunities = false): Promise<EventItem[]> {
  if (!supabase || (!communityIds.length && !allCommunities)) return []
  let query = supabase.from('events').select('*, community:communities!inner(name,slug,status)').order('starts_at', { ascending: true }).limit(100)
  if (communityIds.length) query = query.in('community_id', communityIds)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapEvent)
}

export async function saveEvent(input: EventInput, eventId?: string): Promise<EventItem> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const payload = {
    community_id: input.communityId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    type: input.type,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    timezone: 'America/Lima',
    location_type: input.locationType,
    venue_name: input.venueName || null,
    address: input.address || null,
    map_url: input.mapUrl || null,
    meeting_url: input.meetingUrl || null,
    meeting_provider: input.meetingProvider,
    visibility: input.visibility,
    status: input.status,
  }
  const request = eventId ? supabase.from('events').update(payload).eq('id', eventId) : supabase.from('events').insert(payload)
  const { data, error } = await request.select('*, community:communities!inner(name,slug,status)').single()
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
