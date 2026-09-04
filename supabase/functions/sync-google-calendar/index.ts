import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, json, options } from '../_shared/cors.ts'
import { getGoogleAccessToken, readServiceAccountSecret } from '../_shared/google-auth.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const DEFAULT_APP_URL = 'https://eventos.igda.pe'
const SYNC_SOURCE = 'eventos.igda.pe'

type CalendarEvent = {
  id?: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; timeZone?: string }
  end?: { dateTime?: string; timeZone?: string }
  visibility?: string
  extendedProperties?: { private?: Record<string, string> }
}

type GoogleListResponse = { items?: CalendarEvent[]; nextPageToken?: string }

type SourceEvent = {
  id: string
  slug: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  timezone: string | null
  location_type: 'venue' | 'online' | 'hybrid'
  venue_name: string | null
  address: string | null
  meeting_url: string | null
  community: { name: string; slug: string; status: 'approved' | 'pending' | 'suspended' } | null
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null) {
    const details = error as { message?: unknown; error?: { message?: unknown } }
    if (typeof details.message === 'string' && details.message) return details.message
    if (typeof details.error?.message === 'string' && details.error.message) return details.error.message
    try {
      const serialized = JSON.stringify(error)
      if (serialized && serialized !== '{}') return serialized
    } catch {
      // Use the generic message below.
    }
  }
  return String(error || 'Unexpected error')
}

function calendarEventId(sourceId: string) {
  // Google Calendar IDs must use lowercase base32hex characters. UUIDs are
  // hexadecimal, so removing hyphens gives us a deterministic valid ID.
  return `igdaperu${sourceId.replaceAll('-', '').toLowerCase()}`
}

function calendarLocation(event: SourceEvent) {
  const venue = [event.venue_name, event.address].filter(Boolean).join(' · ')
  if (event.location_type === 'online') return event.meeting_url ? `Online · ${event.meeting_url}` : 'Online'
  if (event.location_type === 'hybrid') return [venue, event.meeting_url ? `Online · ${event.meeting_url}` : 'Online'].filter(Boolean).join(' · ')
  return venue || 'Por confirmar'
}

function calendarDescription(event: SourceEvent, appUrl: string) {
  const details = [
    `Comunidad: ${event.community?.name || 'IGDA Perú'}`,
    '',
    event.description?.trim() || 'Más información en la agenda.',
    '',
    `Ver detalles: ${appUrl}/eventos/${event.slug}`,
  ]
  return details.join('\n')
}

function makeCalendarEvent(event: SourceEvent, appUrl: string): CalendarEvent {
  const timezone = event.timezone || 'America/Lima'
  return {
    id: calendarEventId(event.id),
    summary: event.title,
    description: calendarDescription(event, appUrl),
    location: calendarLocation(event),
    start: { dateTime: event.starts_at, timeZone: timezone },
    end: { dateTime: event.ends_at, timeZone: timezone },
    visibility: 'public',
    extendedProperties: {
      private: {
        igda_source: SYNC_SOURCE,
        igda_event_id: event.id,
      },
    },
  }
}

async function googleRequest<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const result = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!response.ok) {
    const message = result.error?.message || `Google Calendar respondió ${response.status}`
    const error = new Error(message)
    Object.assign(error, { status: response.status })
    throw error
  }
  return result
}

async function listManagedCalendarEvents(accessToken: string, calendarId: string) {
  const events: CalendarEvent[] = []
  let pageToken = ''
  do {
    const params = new URLSearchParams({
      maxResults: '2500',
      showDeleted: 'false',
      privateExtendedProperty: `igda_source=${SYNC_SOURCE}`,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const result = await googleRequest<GoogleListResponse>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    )
    events.push(...(result.items || []))
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return events
}

async function insertCalendarEvent(accessToken: string, calendarId: string, event: CalendarEvent) {
  try {
    return await googleRequest<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
      { method: 'POST', body: JSON.stringify(event) },
    )
  } catch (error) {
    // A concurrent sync can win the insert race. In that case, update the
    // deterministic ID instead of producing a failed partial synchronization.
    if ((error as { status?: number }).status !== 409 || !event.id) throw error
    return googleRequest<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}?sendUpdates=none`,
      { method: 'PUT', body: JSON.stringify(event) },
    )
  }
}

async function updateCalendarEvent(accessToken: string, calendarId: string, event: CalendarEvent) {
  return googleRequest<CalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id || '')}?sendUpdates=none`,
    { method: 'PUT', body: JSON.stringify(event) },
  )
}

async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string) {
  await googleRequest<Record<string, never>>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}

async function loadPublicEvents() {
  const { data, error } = await admin
    .from('events')
    .select('id,slug,title,description,starts_at,ends_at,timezone,location_type,venue_name,address,meeting_url,community:communities!inner(name,slug,status)')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('community.status', 'approved')
    .not('starts_at', 'is', null)
    .not('ends_at', 'is', null)
    .order('starts_at', { ascending: true })
    .limit(1000)
  if (error) throw error
  return (data || []).map((row: any) => ({
    ...row,
    community: Array.isArray(row.community) ? row.community[0] || null : row.community,
  })) as SourceEvent[]
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let stage = 'authentication'
  try {
    const accessToken = bearerToken(request)
    if (!accessToken) return json({ error: 'Authentication required' }, 401)
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)

    stage = 'validating-platform-admin'
    const { data: platformMembership, error: membershipError } = await admin
      .from('memberships')
      .select('role')
      .eq('user_id', authData.user.id)
      .is('community_id', null)
      .eq('role', 'platform_admin')
      .eq('status', 'active')
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!platformMembership) return json({ error: 'Solo un administrador de IGDA puede sincronizar Google Calendar' }, 403)

    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')
    if (!calendarId) throw new Error('Falta el secret GOOGLE_CALENDAR_ID')
    const appUrl = (Deno.env.get('APP_URL') || DEFAULT_APP_URL).replace(/\/$/, '')

    stage = 'reading-google-credentials'
    const serviceAccount = await readServiceAccountSecret()
    const googleToken = await getGoogleAccessToken(serviceAccount, GOOGLE_CALENDAR_SCOPE)

    stage = 'loading-database-events'
    const sourceEvents = await loadPublicEvents()
    const desiredBySourceId = new Map(sourceEvents.map((event) => [event.id, makeCalendarEvent(event, appUrl)]))

    stage = 'loading-calendar-events'
    const remoteEvents = await listManagedCalendarEvents(googleToken, calendarId)
    const remoteBySourceId = new Map(
      remoteEvents
        .map((event) => [event.extendedProperties?.private?.igda_event_id, event] as const)
        .filter(([sourceId]) => Boolean(sourceId)),
    )

    let created = 0
    let updated = 0
    let removed = 0
    let errors = 0
    const errorItems: Array<{ eventId?: string; message: string }> = []

    stage = 'syncing-calendar-events'
    for (const [sourceId, desiredEvent] of desiredBySourceId) {
      try {
        if (remoteBySourceId.has(sourceId)) {
          await updateCalendarEvent(googleToken, calendarId, desiredEvent)
          updated += 1
        } else {
          await insertCalendarEvent(googleToken, calendarId, desiredEvent)
          created += 1
        }
      } catch (error) {
        errors += 1
        errorItems.push({ eventId: sourceId, message: errorMessage(error) })
      }
    }

    for (const remoteEvent of remoteEvents) {
      const sourceId = remoteEvent.extendedProperties?.private?.igda_event_id
      if (!sourceId || desiredBySourceId.has(sourceId) || !remoteEvent.id) continue
      try {
        await deleteCalendarEvent(googleToken, calendarId, remoteEvent.id)
        removed += 1
      } catch (error) {
        errors += 1
        errorItems.push({ eventId: sourceId, message: errorMessage(error) })
      }
    }

    await admin.from('audit_log').insert({
      actor_id: authData.user.id,
      action: 'events.google_calendar_sync',
      entity_type: 'google_calendar',
      metadata: { calendar_id: calendarId, created, updated, removed, errors, source_events: sourceEvents.length },
    })

    return json({
      calendarId,
      sourceEvents: sourceEvents.length,
      created,
      updated,
      removed,
      errors,
      errorItems,
    })
  } catch (error) {
    const message = errorMessage(error)
    console.error('sync-google-calendar failed', { stage, message })
    return json({ error: message, stage }, 500)
  }
})
