import { demoCommunities, demoConversations, demoEvents, demoMessages } from './demo-data'
import { isSupabaseConfigured, supabase } from './supabase'
import { eventIntervalsOverlap } from './eventConflicts'
import type { ChatIdentity, ChatMessage, Community, CommunityConversation, CommunityMember, CommunityMemberEmail, CommunitySyncResult, EventConflict, EventInput, EventItem, EventProposal, EventProposalStatus, EventReport, GoogleCalendarSyncResult, Membership, Profile, Role } from '../types'
import { isEventPast } from './format'
import { communityLogoOptimization, eventBannerOptimization, optimizeImageForUpload } from './imageOptimization'

export type EventQueryOptions = { communitySlug?: string; search?: string; network?: boolean; upcomingOnly?: boolean; limit?: number }

type PublicCacheEntry<T> = {
  expiresAt: number
  value: T
}

const PUBLIC_COMMUNITIES_CACHE_TTL = 5 * 60 * 1000
const PUBLIC_EVENTS_CACHE_TTL = 60 * 1000
let publicCommunitiesCache: PublicCacheEntry<Community[]> | null = null
let publicCommunitiesRequest: Promise<Community[]> | null = null
const publicEventsCache = new Map<string, PublicCacheEntry<EventItem[]>>()
const publicEventsRequests = new Map<string, Promise<EventItem[]>>()

const COMMUNITY_SELECT = 'id,slug,name,description,logo_path,website_url,discord_url,status'
const PROFILE_SELECT = 'id,display_name,first_name,last_name,avatar_path'
const EVENT_SELECT = 'id,slug,community_id,organizer_name,title,description,type,starts_at,ends_at,is_all_day,timezone,location_type,access_mode,location_precision,location_department,location_province,venue_name,address,map_url,place_id,formatted_address,latitude,longitude,meeting_url,meeting_provider,registration_url,cover_path,visibility,status,community:communities(name,slug,status,logo_path)'
const PROPOSAL_SELECT = 'id,organizer_name,contact_email,title,description,type,starts_at,ends_at,is_all_day,timezone,location_type,access_mode,location_precision,location_department,location_province,venue_name,address,map_url,place_id,formatted_address,latitude,longitude,meeting_url,meeting_provider,registration_url,community_id,status,review_notes,rejection_reason,reviewed_at,approved_event_id,created_at,community:communities(name)'

function getPublicEventsCacheKey(options: EventQueryOptions) {
  return JSON.stringify({
    communitySlug: options.communitySlug || '',
    search: options.search?.trim() || '',
    upcomingOnly: Boolean(options.upcomingOnly),
    limit: options.limit || 50,
  })
}

function rememberPublicEvents(key: string, value: EventItem[]) {
  publicEventsCache.set(key, { value, expiresAt: Date.now() + PUBLIC_EVENTS_CACHE_TTL })
  if (publicEventsCache.size > 20) {
    const oldestKey = publicEventsCache.keys().next().value
    if (oldestKey) publicEventsCache.delete(oldestKey)
  }
}

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
  const accessMode = row.access_mode || 'location_access'
  return {
    id: row.id,
    slug: row.slug,
    communityId: row.community_id,
    communityName: community?.name || row.organizer_name || 'Evento independiente',
    communitySlug: community?.slug || '',
    communityLogoPath: community?.logo_path,
    organizerName: row.organizer_name || null,
    creatorEmail: row.creator_email || null,
    title: row.title,
    description: row.description || '',
    type: row.type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAllDay: Boolean(row.is_all_day),
    timezone: row.timezone || 'America/Lima',
    locationType: row.location_type,
    accessMode,
    locationPrecision: accessMode === 'registration_only' ? 'none' : row.location_precision || (row.venue_name || row.address || row.formatted_address || row.latitude != null || row.longitude != null ? 'exact' : 'none'),
    locationDepartment: accessMode === 'registration_only' ? null : row.location_department,
    locationProvince: accessMode === 'registration_only' ? null : row.location_province,
    venueName: accessMode === 'registration_only' ? null : row.venue_name,
    address: accessMode === 'registration_only' ? null : row.address,
    mapUrl: accessMode === 'registration_only' ? null : row.map_url,
    placeId: accessMode === 'registration_only' ? null : row.place_id,
    formattedAddress: accessMode === 'registration_only' ? null : row.formatted_address,
    latitude: accessMode === 'registration_only' ? null : row.latitude,
    longitude: accessMode === 'registration_only' ? null : row.longitude,
    meetingUrl: accessMode === 'registration_only' ? null : row.meeting_url,
    meetingProvider: accessMode === 'registration_only' ? 'other' : row.meeting_provider || 'other',
    registrationUrl: row.registration_url,
    coverPath: row.cover_path,
    visibility: row.visibility,
    status: row.status,
  }
}

const mapEventProposal = (row: any): EventProposal => {
  const community = Array.isArray(row.community) ? row.community[0] : row.community
  return {
    id: row.id,
    organizerName: row.organizer_name,
    contactEmail: row.contact_email,
    title: row.title,
    description: row.description || '',
    type: row.type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAllDay: Boolean(row.is_all_day),
    timezone: row.timezone || 'America/Lima',
    locationType: row.location_type,
    accessMode: row.access_mode || 'registration_only',
    locationPrecision: row.location_precision || 'none',
    locationDepartment: row.location_department,
    locationProvince: row.location_province,
    venueName: row.venue_name,
    address: row.address,
    mapUrl: row.map_url,
    placeId: row.place_id,
    formattedAddress: row.formatted_address,
    latitude: row.latitude,
    longitude: row.longitude,
    meetingUrl: row.meeting_url,
    meetingProvider: row.meeting_provider || 'other',
    registrationUrl: row.registration_url,
    communityId: row.community_id,
    communityName: community?.name || null,
    status: row.status,
    reviewNotes: row.review_notes || '',
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    approvedEventId: row.approved_event_id,
    createdAt: row.created_at,
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
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  if (!includeUnapproved && import.meta.env.PROD && !localHost) {
    const cached = publicCommunitiesCache
    if (cached && cached.expiresAt > Date.now()) return cached.value
    if (publicCommunitiesRequest) return publicCommunitiesRequest
    publicCommunitiesRequest = (async () => {
      const response = await fetch(new URL('/api/public-communities', window.location.origin))
      if (!response.ok) throw new Error('No pudimos cargar las comunidades.')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('La respuesta de comunidades no es válida.')
      const value = data.map(mapCommunity)
      publicCommunitiesCache = { value, expiresAt: Date.now() + PUBLIC_COMMUNITIES_CACHE_TTL }
      return value
    })()
    try {
      return await publicCommunitiesRequest
    } finally {
      publicCommunitiesRequest = null
    }
  }
  let query = supabase.from('communities').select(COMMUNITY_SELECT).order('name')
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
  const optimizedFile = await optimizeImageForUpload(file, communityLogoOptimization)
  const extension = 'webp'
  const path = `${communityId}/logo-${crypto.randomUUID()}.${extension}`
  const storage = supabase.storage.from('community-assets')
  const { error: uploadError } = await storage.upload(path, optimizedFile, { cacheControl: '31536000', contentType: optimizedFile.type, upsert: false })
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
  const optimizedFile = await optimizeImageForUpload(file, eventBannerOptimization)
  const extension = 'webp'
  const path = `${eventId}/banner-${crypto.randomUUID()}.${extension}`
  const storage = supabase.storage.from('event-assets')
  const { error: uploadError } = await storage.upload(path, optimizedFile, { cacheControl: '31536000', contentType: optimizedFile.type, upsert: false })
  if (uploadError) throw uploadError
  const { error: updateError } = await supabase.from('events').update({ cover_path: path }).eq('id', eventId)
  if (updateError) {
    await storage.remove([path])
    throw updateError
  }
  if (previousPath && !previousPath.startsWith('/') && !/^https?:\/\//i.test(previousPath)) await storage.remove([previousPath])
  return path
}

export type AssetMigrationProgress = {
  completed: number
  total: number
  label: string
}

export type AssetMigrationError = {
  label: string
  message: string
}

export type AssetMigrationResult = {
  total: number
  migrated: number
  skipped: number
  failed: number
  errors: AssetMigrationError[]
}

type ExistingAsset = {
  kind: 'logo' | 'banner'
  id: string
  label: string
  path: string
}

async function listExistingAssets(): Promise<ExistingAsset[]> {
  if (!supabase) throw new Error('Supabase no está configurado.')

  const assets: ExistingAsset[] = []
  const pageSize = 500

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('communities')
      .select('id,name,logo_path')
      .not('logo_path', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw error

    for (const row of data || []) {
      if (typeof row.logo_path === 'string' && row.logo_path.trim()) {
        assets.push({ kind: 'logo', id: row.id, label: row.name || row.id, path: row.logo_path })
      }
    }
    if (!data || data.length < pageSize) break
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('events')
      .select('id,title,cover_path')
      .not('cover_path', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw error

    for (const row of data || []) {
      if (typeof row.cover_path === 'string' && row.cover_path.trim()) {
        assets.push({ kind: 'banner', id: row.id, label: row.title || row.id, path: row.cover_path })
      }
    }
    if (!data || data.length < pageSize) break
  }

  return assets
}

function assetFileName(path: string) {
  return path.split('/').pop() || 'asset'
}

export async function migrateExistingAssets(onProgress?: (progress: AssetMigrationProgress) => void): Promise<AssetMigrationResult> {
  const assets = await listExistingAssets()
  const result: AssetMigrationResult = { total: assets.length, migrated: 0, skipped: 0, failed: 0, errors: [] }

  for (const [index, asset] of assets.entries()) {
    const progress = { completed: index, total: assets.length, label: asset.label }
    onProgress?.(progress)

    if (/\.webp$/i.test(asset.path)) {
      result.skipped += 1
      onProgress?.({ ...progress, completed: index + 1 })
      continue
    }

    try {
      const sourceUrl = asset.kind === 'logo' ? getCommunityLogoUrl(asset.path) : getEventCoverUrl(asset.path)
      if (!sourceUrl) throw new Error('No se pudo resolver la URL pública del archivo.')

      const response = await fetch(sourceUrl, { cache: 'no-store' })
      if (!response.ok) throw new Error(`No se pudo descargar el archivo (${response.status}).`)
      const blob = await response.blob()
      const type = blob.type.startsWith('image/')
        ? blob.type
        : /\.png$/i.test(asset.path) ? 'image/png' : 'image/jpeg'
      const file = new File([blob], assetFileName(asset.path), { type })

      if (asset.kind === 'logo') await uploadCommunityLogo(asset.id, file, asset.path)
      else await uploadEventBanner(asset.id, file, asset.path)
      result.migrated += 1
    } catch (reason) {
      result.failed += 1
      if (result.errors.length < 10) {
        result.errors.push({ label: asset.label, message: reason instanceof Error ? reason.message : 'Error desconocido.' })
      }
    }

    onProgress?.({ ...progress, completed: index + 1 })
  }

  return result
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

  const hostname = typeof window === 'undefined' ? '' : window.location.hostname
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  if (!options.network && import.meta.env.PROD && !localHost) {
    const cacheKey = getPublicEventsCacheKey(options)
    const cached = publicEventsCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const pending = publicEventsRequests.get(cacheKey)
    if (pending) return pending
    const endpoint = new URL('/api/public-events', window.location.origin)
    if (options.communitySlug) endpoint.searchParams.set('community', options.communitySlug)
    if (options.search?.trim()) endpoint.searchParams.set('search', options.search.trim())
    if (options.upcomingOnly) endpoint.searchParams.set('upcoming', '1')
    if (options.limit) endpoint.searchParams.set('limit', String(options.limit))
    const request = (async () => {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('No pudimos cargar los eventos.')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('La respuesta de eventos no es válida.')
      const value = data.map(mapEvent)
      rememberPublicEvents(cacheKey, value)
      return value
    })()
    publicEventsRequests.set(cacheKey, request)
    try {
      return await request
    } finally {
      publicEventsRequests.delete(cacheKey)
    }
  }

  let query = supabase
    .from('events')
    .select(options.communitySlug ? EVENT_SELECT.replace('community:communities(', 'community:communities!inner(') : EVENT_SELECT)
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
    .select('id,title,starts_at,ends_at,is_all_day,organizer_name,community:communities(name,status)')
    .eq('status', 'published')
    .in('visibility', ['public', 'network'])
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)
    .order('starts_at', { ascending: true })
    .limit(4)
  if (excludeEventId) query = query.neq('id', excludeEventId)

  const { data, error } = await query
  if (error) throw error
  const rows = (data || []).map((row: any) => {
    const community = Array.isArray(row.community) ? row.community[0] : row.community
    return { id: row.id, title: row.title, communityName: community?.name || row.organizer_name || 'Evento independiente', startsAt: row.starts_at, endsAt: row.ends_at, isAllDay: Boolean(row.is_all_day), approved: !community || community.status === 'approved' } as EventConflict & { approved: boolean }
  })
  const approvedRows = rows.filter((row) => row.approved)
  return { conflicts: approvedRows.slice(0, 3), hasMore: approvedRows.length > 3 }
}

export async function getEventBySlug(slug: string, network = false): Promise<EventItem | null> {
  if (!isSupabaseConfigured || !supabase) return demoEvents.find((event) => event.slug === slug) || null
  let query = supabase.from('events').select(EVENT_SELECT).eq('slug', slug)
  if (!network) query = query.eq('visibility', 'public')
  query = query.in('status', ['published', 'archived'])
  const singleQuery = query.maybeSingle()
  const { data, error } = await singleQuery
  if (error) throw error
  return data ? mapEvent(data) : null
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle()
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

export async function createInvitation(email: string, communityId: string, role: 'community_editor' | 'community_admin', turnstileToken = ''): Promise<{ inviteUrl: string; expiresAt: string }> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('create-invitation', {
    body: { email, communityId, role, ...(turnstileToken ? { turnstileToken } : {}) },
  })
  if (error) throw await invokeFunctionError(error)
  if (!data || typeof data !== 'object' || typeof (data as { inviteUrl?: unknown }).inviteUrl !== 'string') {
    throw new Error('La invitación devolvió una respuesta inválida.')
  }
  return data as { inviteUrl: string; expiresAt: string }
}

export async function listManagedEvents(communityIds: string[], allCommunities = false): Promise<EventItem[]> {
  if (!supabase || (!communityIds.length && !allCommunities)) return []
  let query = supabase.from('events').select(EVENT_SELECT).order('starts_at', { ascending: true }).limit(100)
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

export type EventProposalSubmission = {
  organizerName: string
  contactEmail: string
  title: string
  description: string
  type: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  locationType: EventInput['locationType']
  accessMode: EventInput['accessMode']
  locationPrecision: EventInput['locationPrecision']
  locationDepartment: string
  locationProvince: string
  venueName: string
  address: string
  mapUrl: string
  placeId: string
  formattedAddress: string
  latitude: number | null
  longitude: number | null
  meetingUrl: string
  meetingProvider: EventInput['meetingProvider']
  registrationUrl: string
  turnstileToken: string
  honeypot: string
}

export async function submitEventProposal(input: EventProposalSubmission): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.functions.invoke('submit-event-proposal', { body: input })
  if (error) throw await invokeFunctionError(error)
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) throw new Error('La propuesta no devolvió una respuesta válida.')
}

export async function listEventProposals(status?: EventProposalStatus): Promise<EventProposal[]> {
  if (!supabase) return []
  let query = supabase.from('event_proposals').select(PROPOSAL_SELECT).order('created_at', { ascending: false }).limit(200)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapEventProposal)
}

export async function updateEventProposal(proposalId: string, values: Partial<EventProposalSubmission> & { communityId?: string | null; reviewNotes?: string }): Promise<EventProposal> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const payload = {
    organizer_name: values.organizerName,
    contact_email: values.contactEmail,
    title: values.title,
    description: values.description,
    type: values.type,
    starts_at: values.startsAt,
    ends_at: values.endsAt,
    is_all_day: values.isAllDay,
    location_type: values.locationType,
    access_mode: values.accessMode,
    location_precision: values.locationPrecision,
    location_department: values.locationDepartment || null,
    location_province: values.locationProvince || null,
    venue_name: values.venueName || null,
    address: values.address || null,
    map_url: values.mapUrl || null,
    place_id: values.placeId || null,
    formatted_address: values.formattedAddress || null,
    latitude: values.latitude,
    longitude: values.longitude,
    meeting_url: values.meetingUrl || null,
    meeting_provider: values.meetingProvider,
    registration_url: values.registrationUrl || null,
    community_id: values.communityId === undefined ? undefined : values.communityId,
    review_notes: values.reviewNotes,
  }
  const { data, error } = await supabase.from('event_proposals').update(payload).eq('id', proposalId).select(PROPOSAL_SELECT).single()
  if (error) throw error
  return mapEventProposal(data)
}

export async function approveEventProposal(proposalId: string, communityId: string | null, reviewNotes: string): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.rpc('approve_event_proposal', { p_proposal_id: proposalId, p_community_id: communityId, p_review_notes: reviewNotes })
  if (error) throw error
  return String(data)
}

export async function rejectEventProposal(proposalId: string, rejectionReason: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.rpc('reject_event_proposal', { p_proposal_id: proposalId, p_rejection_reason: rejectionReason })
  if (error) throw error
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
  const managesLocationAccess = input.accessMode === 'location_access'
  const shareExactLocation = managesLocationAccess && input.locationType !== 'online' && input.locationPrecision === 'exact'
  const shareGeneralLocation = managesLocationAccess && input.locationType !== 'online' && (input.locationPrecision === 'department' || input.locationPrecision === 'province')
  const payload = {
    community_id: input.communityId,
    organizer_name: input.organizerName?.trim() || null,
    slug: input.slug,
    title: input.title,
    description: input.description,
    type: input.type,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    is_all_day: input.isAllDay,
    timezone: 'America/Lima',
    access_mode: input.accessMode,
    location_type: managesLocationAccess ? input.locationType : 'venue',
    location_precision: managesLocationAccess && input.locationType !== 'online' ? input.locationPrecision : 'none',
    location_department: shareGeneralLocation ? input.locationDepartment || null : null,
    location_province: input.locationPrecision === 'province' && shareGeneralLocation ? input.locationProvince || null : null,
    venue_name: shareExactLocation ? input.venueName || null : null,
    address: shareExactLocation ? input.address || null : null,
    map_url: shareExactLocation ? input.mapUrl || null : null,
    place_id: shareExactLocation ? input.placeId || null : null,
    formatted_address: shareExactLocation ? input.formattedAddress || null : null,
    latitude: shareExactLocation ? input.latitude : null,
    longitude: shareExactLocation ? input.longitude : null,
    meeting_url: managesLocationAccess ? input.meetingUrl || null : null,
    meeting_provider: managesLocationAccess ? input.meetingProvider : 'other',
    registration_url: input.registrationUrl || null,
    cover_path: input.coverPath || null,
    visibility: input.visibility,
    status: input.status,
  }
  const request = eventId ? supabase.from('events').update(payload).eq('id', eventId) : supabase.from('events').insert(payload)
  const { data, error } = await request.select(EVENT_SELECT).single()
  if (error) {
    const details = [error.message, error.details, error.hint].filter(Boolean).join(' · ')
    throw new Error(details || 'No pudimos guardar el evento.')
  }
  return mapEvent(data)
}

export async function archiveEvent(eventId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('events').update({ status: 'archived' }).eq('id', eventId)
  if (error) throw error
}

export async function deleteEvent(eventId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data: event, error: readError } = await supabase.from('events').select('cover_path').eq('id', eventId).maybeSingle()
  if (readError) throw readError
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
  if (event?.cover_path && !event.cover_path.startsWith('/') && !/^https?:\/\//i.test(event.cover_path)) {
    const { error: storageError } = await supabase.storage.from('event-assets').remove([event.cover_path])
    if (storageError) console.warn('No pudimos eliminar el banner del evento eliminado.', storageError)
  }
}

export async function removeEventBanner(path: string) {
  if (!supabase || !path || path.startsWith('/') || /^https?:\/\//i.test(path)) return
  const { error } = await supabase.storage.from('event-assets').remove([path])
  if (error) throw error
}

export async function updateCommunityStatus(communityId: string, status: 'approved' | 'suspended') {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('communities').update({ status }).eq('id', communityId)
  if (error) throw error
}

export async function createCommunity(name: string, slug: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.from('communities').insert({ name, slug, status: 'pending' }).select(COMMUNITY_SELECT).single()
  if (error) throw error
  return mapCommunity(data)
}

export async function updateCommunity(communityId: string, values: { description: string; websiteUrl?: string; discordUrl?: string }) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.from('communities').update({ description: values.description, website_url: values.websiteUrl || null, discord_url: values.discordUrl || null }).eq('id', communityId).select(COMMUNITY_SELECT).single()
  if (error) throw error
  return mapCommunity(data)
}

export async function createEventReport(eventId: string, reason: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.functions.invoke('create-event-report', { body: { eventId, reason } })
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
