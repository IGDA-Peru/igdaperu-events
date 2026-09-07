import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, corsHeaders, json, options, readJsonBody, sha256 } from '../_shared/cors.ts'
import { enforceRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { verifyTurnstile } from '../_shared/turnstile.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const accessToken = bearerToken(request)
    if (!accessToken) return json({ error: 'Authentication required' }, 401)
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
    if (authError || !authData.user) return json({ error: 'Invalid session' }, 401)

    const limit = await enforceRateLimit(admin, request, 'accept-invitation', authData.user.id, { windowSeconds: 3600, maxRequests: 10 })
    if (!limit.allowed) return rateLimitResponse(limit, 'Demasiados intentos de invitación. Intenta nuevamente más tarde.')

    const parsed = await readJsonBody<{ token?: unknown; turnstileToken?: unknown }>(request)
    if (parsed.tooLarge) return json({ error: 'La solicitud es demasiado grande.' }, 413)
    if (parsed.invalid || !parsed.value) return json({ error: 'La solicitud no es válida.' }, 400)
    const token = typeof parsed.value.token === 'string' ? parsed.value.token.trim() : ''
    const turnstileToken = typeof parsed.value.turnstileToken === 'string' ? parsed.value.turnstileToken.trim().slice(0, 2048) : ''
    if (!token) return json({ error: 'Invitation token is required' }, 400)
    if (token.length > 256) return json({ error: 'El token de invitación no es válido.' }, 400)
    if (!(await verifyTurnstile(turnstileToken, request, 'accept-invitation'))) return json({ error: 'No pudimos verificar que eres una persona. Recarga el formulario e inténtalo nuevamente.' }, 403)

    const userScopedAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: result, error: acceptError } = await userScopedAdmin.rpc('accept_invitation', { p_token_hash: await sha256(token) })
    if (acceptError || !result?.length) return json({ error: acceptError?.message || 'No pudimos aceptar la invitación' }, 400)

    const accepted = result[0]
    await admin.from('audit_log').insert({ actor_id: authData.user.id, action: 'invitation.accepted', entity_type: 'community', entity_id: accepted.community_id, metadata: { role: accepted.role } })
    return new Response(JSON.stringify({ communityId: accepted.community_id, role: accepted.role }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
