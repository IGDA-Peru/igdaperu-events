import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, json, options, readJsonBody } from '../_shared/cors.ts'
import { enforceRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const accessToken = bearerToken(request)
    if (!accessToken) return json({ error: 'Authentication required' }, 401)
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)

    const limit = await enforceRateLimit(admin, request, 'event-report', authData.user.id, { windowSeconds: 3600, maxRequests: 5 })
    if (!limit.allowed) return rateLimitResponse(limit)

    const parsed = await readJsonBody<{ eventId?: unknown; reason?: unknown; turnstileToken?: unknown }>(request)
    if (parsed.tooLarge) return json({ error: 'La solicitud es demasiado grande.' }, 413)
    if (parsed.invalid || !parsed.value) return json({ error: 'La solicitud no es válida.' }, 400)
    const eventId = typeof parsed.value.eventId === 'string' ? parsed.value.eventId.trim() : ''
    const reason = typeof parsed.value.reason === 'string' ? parsed.value.reason.trim() : ''
    const turnstileToken = typeof parsed.value.turnstileToken === 'string' ? parsed.value.turnstileToken.trim().slice(0, 2048) : ''
    if (!isUuid(eventId)) return json({ error: 'El evento no es válido.' }, 400)
    if (reason.length < 5 || reason.length > 500) return json({ error: 'El motivo debe tener entre 5 y 500 caracteres.' }, 400)
    if (!(await verifyTurnstile(turnstileToken, request, 'event-report'))) return json({ error: 'No pudimos verificar que eres una persona. Recarga el formulario e inténtalo nuevamente.' }, 403)

    const { data: event, error: eventError } = await admin
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('visibility', 'public')
      .in('status', ['published', 'archived'])
      .maybeSingle()
    if (eventError || !event) return json({ error: 'Evento no encontrado.' }, 404)

    const { error: insertError } = await admin.from('event_reports').insert({ event_id: eventId, reporter_id: authData.user.id, reason })
    if (insertError) return json({ error: 'No pudimos registrar el reporte.' }, 400)
    return json({ ok: true })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No pudimos registrar el reporte.' }, 500)
  }
})
