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
const SYNC_VERSION = '2026-09-05-mapping-v2'

type CalendarEvent = {
  id?: string
  summary?: string
  description?: string
  location?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  visibility?: string
  conferenceData?: {
    conferenceSolution?: { key?: { type?: string }; name?: string }
    entryPoints?: Array<{ entryPointType: string; uri: string; label?: string }>
  }
  extendedProperties?: { private?: Record<string, string> }
}

type GoogleListResponse = { items?: CalendarEvent[]; nextPageToken?: string }

type SourceEvent = {
  id: string
  updated_at: string
  slug: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  is_all_day: boolean
  timezone: string | null
  location_type: 'venue' | 'online' | 'hybrid'
  venue_name: string | null
  address: string | null
  formatted_address: string | null
  map_url: string | null
  meeting_url: string | null
  meeting_provider: 'google_meet' | 'zoom' | 'discord' | 'other' | null
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
  const venue = [event.venue_name, event.address || event.formatted_address].filter(Boolean).join(' · ')
  if (event.location_type === 'online') return 'Online'
  return venue || 'Por confirmar'
}

function calendarDescription(event: SourceEvent, appUrl: string, includeGoogleMeetLink = false) {
  const details = [
    `Comunidad: ${event.community?.name || 'IGDA Perú'}`,
    '',
    event.description?.trim() || 'Más información en la agenda.',
  ]
  const additionalDetails = [
    event.meeting_url && (event.meeting_provider !== 'google_meet' || includeGoogleMeetLink) ? `Enlace para conectarse: ${event.meeting_url}` : '',
    event.map_url ? `Mapa: ${event.map_url}` : '',
    `Ver detalles: ${appUrl}/eventos/${event.slug}`,
  ].filter(Boolean)
  if (additionalDetails.length) details.push('', ...additionalDetails)
  return details.join('\n')
}

function calendarConference(event: SourceEvent) {
  if (event.meeting_provider !== 'google_meet' || !event.meeting_url) return undefined
  return {
    conferenceSolution: { key: { type: 'hangoutsMeet' }, name: 'Google Meet' },
    entryPoints: [{ entryPointType: 'video', uri: event.meeting_url, label: event.meeting_url.replace(/^https?:\/\//, '') }],
  }
}

function calendarDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function makeCalendarEvent(event: SourceEvent, appUrl: string, includeGoogleMeetLink = false): CalendarEvent {
  const timezone = event.timezone || 'America/Lima'
  return {
    id: calendarEventId(event.id),
    summary: event.title,
    description: calendarDescription(event, appUrl, includeGoogleMeetLink),
    location: calendarLocation(event),
    conferenceData: includeGoogleMeetLink ? undefined : calendarConference(event),
    start: event.is_all_day ? { date: calendarDate(event.starts_at, timezone) } : { dateTime: event.starts_at, timeZone: timezone },
    end: event.is_all_day ? { date: calendarDate(event.ends_at, timezone) } : { dateTime: event.ends_at, timeZone: timezone },
    visibility: 'public',
    extendedProperties: {
      private: {
        igda_source: SYNC_SOURCE,
        igda_event_id: event.id,
        igda_source_updated_at: event.updated_at,
        igda_sync_version: SYNC_VERSION,
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
      `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none&conferenceDataVersion=1`,
      { method: 'POST', body: JSON.stringify(event) },
    )
  } catch (error) {
    // A concurrent sync can win the insert race. In that case, update the
    // deterministic ID instead of producing a failed partial synchronization.
    if ((error as { status?: number }).status !== 409 || !event.id) throw error
    return googleRequest<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}?sendUpdates=none&conferenceDataVersion=1`,
      { method: 'PUT', body: JSON.stringify(event) },
    )
  }
}

async function updateCalendarEvent(accessToken: string, calendarId: string, event: CalendarEvent) {
  return googleRequest<CalendarEvent>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id || '')}?sendUpdates=none&conferenceDataVersion=1`,
    { method: 'PUT', body: JSON.stringify(event) },
  )
}

async function saveCalendarEvent(accessToken: string, calendarId: string, event: CalendarEvent, sourceEvent: SourceEvent, appUrl: string, exists: boolean) {
  const write = (payload: CalendarEvent) => exists
    ? updateCalendarEvent(accessToken, calendarId, payload)
    : insertCalendarEvent(accessToken, calendarId, payload)
  try {
    return await write(event)
  } catch (error) {
    // Meet spaces created through the Meet REST API may not be importable as
    // Calendar conferenceData. Keep the sync healthy and expose the link in
    // the description when Calendar rejects the conference payload.
    if (!event.conferenceData || !sourceEvent.meeting_url) throw error
    return write(makeCalendarEvent(sourceEvent, appUrl, true))
  }
}

async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string) {
  try {
    await googleRequest<Record<string, never>>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    )
  } catch (error) {
    // A missing remote event is already in the desired state.
    if ((error as { status?: number }).status !== 404) throw error
  }
}

async function loadPublicEvents(eventId?: string) {
  const query = admin
    .from('events')
    .select('id,updated_at,slug,title,description,starts_at,ends_at,is_all_day,timezone,location_type,venue_name,address,formatted_address,map_url,meeting_url,meeting_provider,community:communities!inner(name,slug,status)')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('community.status', 'approved')
    .not('starts_at', 'is', null)
    .not('ends_at', 'is', null)
    .order('starts_at', { ascending: true })
    .limit(1000)
  if (eventId) query.eq('id', eventId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map((row: any) => ({
    ...row,
    community: Array.isArray(row.community) ? row.community[0] || null : row.community,
  })) as SourceEvent[]
}

function isCalendarEventCurrent(remoteEvent: CalendarEvent | undefined, desiredEvent: CalendarEvent) {
  const remoteProperties = remoteEvent?.extendedProperties?.private
  const desiredProperties = desiredEvent.extendedProperties?.private
  return Boolean(
    remoteProperties?.igda_source_updated_at
      && remoteProperties.igda_source_updated_at === desiredProperties?.igda_source_updated_at
      && remoteProperties.igda_sync_version === desiredProperties?.igda_sync_version,
  )
}

async function syncSingleEvent(
  accessToken: string,
  calendarId: string,
  appUrl: string,
  eventId: string,
  expectedOperation: 'sync' | 'delete' = 'sync',
) {
  const remoteEventId = calendarEventId(eventId)
  if (expectedOperation === 'delete') {
    await deleteCalendarEvent(accessToken, calendarId, remoteEventId)
    return 'removed'
  }

  const sourceEvent = (await loadPublicEvents(eventId))[0]
  if (!sourceEvent) {
    await deleteCalendarEvent(accessToken, calendarId, remoteEventId)
    return 'removed'
  }

  let remoteEvent: CalendarEvent | undefined
  try {
    remoteEvent = await googleRequest<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(remoteEventId)}`,
    )
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error
  }

  const desiredEvent = makeCalendarEvent(sourceEvent, appUrl)
  if (isCalendarEventCurrent(remoteEvent, desiredEvent)) return 'skipped'
  await saveCalendarEvent(accessToken, calendarId, desiredEvent, sourceEvent, appUrl, Boolean(remoteEvent))
  return remoteEvent ? 'updated' : 'created'
}

type SyncJob = {
  id: string
  event_id: string | null
  calendar_event_id: string
  operation: 'sync' | 'delete'
  attempts: number
  locked_at: string | null
}

async function processQueue(calendarId: string, appUrl: string) {
  const { data: jobs, error: claimError } = await admin.rpc('claim_google_calendar_sync_jobs', { p_limit: 10 })
  if (claimError) throw claimError
  const claimedJobs = (jobs || []) as SyncJob[]
  if (!claimedJobs.length) return { processed: 0, completed: 0, failed: 0, skipped: 0 }

  const serviceAccount = await readServiceAccountSecret()
  const googleToken = await getGoogleAccessToken(serviceAccount, GOOGLE_CALENDAR_SCOPE)
  let completed = 0
  let failed = 0
  let skipped = 0

  for (const job of claimedJobs) {
    try {
      let result: 'removed' | 'skipped' | 'updated' | 'created'
      if (!job.event_id) {
        await deleteCalendarEvent(googleToken, calendarId, job.calendar_event_id)
        result = 'removed'
      } else {
        result = await syncSingleEvent(googleToken, calendarId, appUrl, job.event_id, job.operation) as typeof result
      }

      const { data: completedJobs, error: completeError } = await admin
        .from('google_calendar_sync_jobs')
        .update({ status: 'completed', locked_at: null, last_error: null })
        .eq('id', job.id)
        .eq('status', 'processing')
        .eq('locked_at', job.locked_at)
        .select('id')
      if (completeError) throw completeError
      if (!completedJobs?.length) {
        // The trigger replaced this job while it was running. Leave the new
        // pending version untouched so the next poll processes it.
        skipped += 1
      } else if (result === 'skipped') {
        skipped += 1
      } else {
        completed += 1
      }
    } catch (error) {
      failed += 1
      const retrySeconds = Math.min(3600, 60 * (2 ** Math.min(Math.max(job.attempts - 1, 0), 6)))
      const { error: failError } = await admin
        .from('google_calendar_sync_jobs')
        .update({
          status: 'failed',
          locked_at: null,
          run_after: new Date(Date.now() + retrySeconds * 1000).toISOString(),
          last_error: errorMessage(error).slice(0, 2000),
        })
        .eq('id', job.id)
        .eq('status', 'processing')
        .eq('locked_at', job.locked_at)
      if (failError) console.error('Could not mark Google Calendar job as failed', errorMessage(failError))
      console.error('Google Calendar queued sync failed', { jobId: job.id, eventId: job.event_id, message: errorMessage(error) })
    }
  }

  return { processed: claimedJobs.length, completed, failed, skipped }
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let stage = 'authentication'
  try {
    const payload = await request.json().catch(() => ({})) as { mode?: 'queue' | 'full' }
    const internalKey = request.headers.get('x-cron-secret') || request.headers.get('apikey')
    const expectedInternalKey = Deno.env.get('GOOGLE_CALENDAR_SYNC_CRON_SECRET') || serviceRoleKey
    const isInternal = Boolean(internalKey && expectedInternalKey && internalKey === expectedInternalKey)
    const mode = isInternal && payload.mode === 'full' ? 'full' : isInternal ? 'queue' : 'full'
    let actorId: string | null = null

    if (!isInternal) {
      const accessToken = bearerToken(request)
      if (!accessToken) return json({ error: 'Authentication required' }, 401)
      const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
      if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)
      actorId = authData.user.id

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
    }

    const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')
    if (!calendarId) throw new Error('Falta el secret GOOGLE_CALENDAR_ID')
    const appUrl = (Deno.env.get('APP_URL') || DEFAULT_APP_URL).replace(/\/$/, '')

    if (mode === 'queue') {
      stage = 'processing-queue'
      const queueResult = await processQueue(calendarId, appUrl)
      return json({ calendarId, mode, ...queueResult })
    }

    stage = 'reading-google-credentials'
    const serviceAccount = await readServiceAccountSecret()
    const googleToken = await getGoogleAccessToken(serviceAccount, GOOGLE_CALENDAR_SCOPE)

    stage = 'loading-database-events'
    const sourceEvents = await loadPublicEvents()
    const desiredBySourceId = new Map(sourceEvents.map((event) => [event.id, makeCalendarEvent(event, appUrl)]))
    const sourceById = new Map(sourceEvents.map((event) => [event.id, event]))

    stage = 'loading-calendar-events'
    const remoteEvents = await listManagedCalendarEvents(googleToken, calendarId)
    const remoteBySourceId = new Map(
      remoteEvents
        .map((event) => [event.extendedProperties?.private?.igda_event_id, event] as const)
        .filter(([sourceId]) => Boolean(sourceId)),
    )

    let created = 0
    let updated = 0
    let skipped = 0
    let removed = 0
    let errors = 0
    const errorItems: Array<{ eventId?: string; message: string }> = []

    stage = 'syncing-calendar-events'
    for (const [sourceId, desiredEvent] of desiredBySourceId) {
      try {
        const sourceEvent = sourceById.get(sourceId)
        if (!sourceEvent) throw new Error('Evento fuente no encontrado durante la sincronización.')
        const remoteEvent = remoteBySourceId.get(sourceId)
        if (isCalendarEventCurrent(remoteEvent, desiredEvent)) {
          skipped += 1
          continue
        }
        await saveCalendarEvent(googleToken, calendarId, desiredEvent, sourceEvent, appUrl, Boolean(remoteEvent))
        if (remoteEvent) updated += 1
        else created += 1
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
      actor_id: actorId,
      action: 'events.google_calendar_sync',
      entity_type: 'google_calendar',
      metadata: { calendar_id: calendarId, created, updated, skipped, removed, errors, source_events: sourceEvents.length, mode },
    })

    return json({
      calendarId,
      sourceEvents: sourceEvents.length,
      created,
      updated,
      skipped,
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
