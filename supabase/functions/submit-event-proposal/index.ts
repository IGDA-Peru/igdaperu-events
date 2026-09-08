import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, options, readJsonBody, sha256 } from '../_shared/cors.ts'
import { enforceRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

type ProposalBody = {
  organizerName?: unknown
  contactEmail?: unknown
  title?: unknown
  description?: unknown
  type?: unknown
  startsAt?: unknown
  endsAt?: unknown
  isAllDay?: unknown
  locationType?: unknown
  accessMode?: unknown
  locationPrecision?: unknown
  locationDepartment?: unknown
  locationProvince?: unknown
  venueName?: unknown
  address?: unknown
  mapUrl?: unknown
  placeId?: unknown
  formattedAddress?: unknown
  latitude?: unknown
  longitude?: unknown
  meetingUrl?: unknown
  meetingProvider?: unknown
  registrationUrl?: unknown
  turnstileToken?: unknown
  honeypot?: unknown
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  const respond = (body: unknown, status = 200) => json(body, status, request)
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  try {
    const limit = await enforceRateLimit(admin, request, 'event-proposal', null, { windowSeconds: 3600, maxRequests: 5 })
    if (!limit.allowed) return rateLimitResponse(limit, 'Recibimos muchas propuestas desde esta conexión. Intenta nuevamente más tarde.', request)

    const parsed = await readJsonBody<ProposalBody>(request, 32 * 1024)
    if (parsed.tooLarge || parsed.invalid || !parsed.value) return respond({ error: 'La propuesta no es válida.' }, 400)
    const body = parsed.value
    if (text(body.honeypot, 100)) return respond({ ok: true })

    const turnstileToken = text(body.turnstileToken, 2048)
    if (!(await verifyTurnstile(turnstileToken, request, 'event-proposal'))) return respond({ error: 'No pudimos verificar que eres una persona. Recarga el formulario e inténtalo nuevamente.' }, 403)

    const organizerName = text(body.organizerName, 160)
    const contactEmail = text(body.contactEmail, 254).toLowerCase()
    const title = text(body.title, 180)
    const description = text(body.description, 5000)
    const type = text(body.type, 40) || 'CHARLA'
    const startsAt = text(body.startsAt, 80)
    const endsAt = text(body.endsAt, 80)
    const locationType = text(body.locationType, 20)
    const accessMode = text(body.accessMode, 30) || 'registration_only'
    const locationPrecision = text(body.locationPrecision, 20) || 'none'
    const meetingProvider = text(body.meetingProvider, 20) || 'other'
    const registrationUrl = text(body.registrationUrl, 2048)
    const meetingUrl = text(body.meetingUrl, 2048)
    const mapUrl = text(body.mapUrl, 2048)

    if (organizerName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || title.length < 3 || description.length < 3) {
      return respond({ error: 'Completa el nombre, correo, título y descripción de la propuesta.' }, 400)
    }
    if (!startsAt || !endsAt || Number.isNaN(new Date(startsAt).getTime()) || Number.isNaN(new Date(endsAt).getTime()) || new Date(endsAt) <= new Date(startsAt)) {
      return respond({ error: 'La fecha y hora del evento no son válidas.' }, 400)
    }
    if (!['venue', 'online', 'hybrid'].includes(locationType) || !['registration_only', 'location_access'].includes(accessMode) || !['none', 'department', 'province', 'exact'].includes(locationPrecision)) {
      return respond({ error: 'La modalidad o ubicación no son válidas.' }, 400)
    }
    if (locationType !== 'venue' && !meetingUrl) return respond({ error: 'Añade el enlace para unirse al evento online o híbrido.' }, 400)
    if (!['google_meet', 'zoom', 'discord', 'other'].includes(meetingProvider)) return respond({ error: 'El proveedor de conexión no es válido.' }, 400)
    if (registrationUrl && !isHttpUrl(registrationUrl)) return respond({ error: 'El enlace de registro debe comenzar con http:// o https://.' }, 400)
    if (meetingUrl && !isHttpUrl(meetingUrl)) return respond({ error: 'El enlace de conexión debe comenzar con http:// o https://.' }, 400)
    if (mapUrl && !isHttpUrl(mapUrl)) return respond({ error: 'El enlace del mapa debe comenzar con http:// o https://.' }, 400)

    const { data: proposal, error } = await admin.from('event_proposals').insert({
      organizer_name: organizerName,
      contact_email: contactEmail,
      title,
      description,
      type,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      is_all_day: Boolean(body.isAllDay),
      timezone: 'America/Lima',
      location_type: locationType,
      access_mode: accessMode,
      location_precision: locationPrecision,
      location_department: text(body.locationDepartment, 120) || null,
      location_province: text(body.locationProvince, 120) || null,
      venue_name: text(body.venueName, 200) || null,
      address: text(body.address, 300) || null,
      map_url: mapUrl || null,
      place_id: text(body.placeId, 200) || null,
      formatted_address: text(body.formattedAddress, 300) || null,
      latitude: typeof body.latitude === 'number' ? body.latitude : null,
      longitude: typeof body.longitude === 'number' ? body.longitude : null,
      meeting_url: meetingUrl || null,
      meeting_provider: meetingProvider,
      registration_url: registrationUrl || null,
    }).select('id').single()
    if (error || !proposal) return respond({ error: 'No pudimos guardar la propuesta.' }, 500)

    await admin.from('audit_log').insert({ action: 'event_proposal.submitted', entity_type: 'event_proposal', entity_id: proposal.id, metadata: { source: 'public_form', email_hash: await sha256(contactEmail) } })
    return respond({ ok: true })
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'No pudimos registrar la propuesta.' }, 500)
  }
})
