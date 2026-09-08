import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, json, options, randomToken, readJsonBody, sha256 } from '../_shared/cors.ts'
import { GOOGLE_MEET_SCOPE, appUrl, authorizationUrl, encryptSecret, exchangeAuthorizationCode, googleUserInfo, safeReturnPath } from '../_shared/google-meet.ts'
import { enforceRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function getUser(request: Request) {
  const accessToken = bearerToken(request)
  if (!accessToken) return null
  const { data, error } = await admin.auth.getUser(accessToken)
  return error || !data.user ? null : data.user
}

async function canManageCommunity(userId: string, communityId: string) {
  const [{ data: platform }, { data: membership }, { data: community }] = await Promise.all([
    admin.from('memberships').select('role').eq('user_id', userId).is('community_id', null).eq('role', 'platform_admin').eq('status', 'active').maybeSingle(),
    admin.from('memberships').select('role').eq('user_id', userId).eq('community_id', communityId).eq('status', 'active').in('role', ['community_admin']).maybeSingle(),
    admin.from('communities').select('id,status').eq('id', communityId).maybeSingle(),
  ])
  return Boolean(community?.status === 'approved' && (platform || membership))
}

function redirectResult(returnPath: string, result: 'connected' | 'denied' | 'error', communityId?: string) {
  const url = new URL(safeReturnPath(returnPath), `${appUrl()}/`)
  url.searchParams.set('google_meet', result)
  if (communityId) url.searchParams.set('community_id', communityId)
  return Response.redirect(url.toString(), 302)
}

async function handleCallback(request: Request) {
  const query = new URL(request.url).searchParams
  const state = query.get('state')
  const code = query.get('code')
  if (!state) return redirectResult('/app/eventos/nuevo', 'error')

  const { data: oauthState } = await admin.from('google_meet_oauth_states').select('id,user_id,community_id,return_path,expires_at').eq('state_hash', await sha256(state)).maybeSingle()
  if (!oauthState || new Date(oauthState.expires_at).getTime() <= Date.now()) return redirectResult('/app/eventos/nuevo', 'error')
  await admin.from('google_meet_oauth_states').delete().eq('id', oauthState.id)
  if (query.get('error') || !code) return redirectResult(oauthState.return_path, 'denied', oauthState.community_id)

  try {
    const token = await exchangeAuthorizationCode(code)
    if (!token.refresh_token) throw new Error('Google no entregó un refresh token. Vuelve a intentarlo autorizando la cuenta nuevamente.')
    const googleUser = await googleUserInfo(token.access_token!)
    const { error } = await admin.from('google_meet_connections').upsert({
      community_id: oauthState.community_id,
      connected_by: oauthState.user_id,
      google_subject: googleUser.sub,
      google_email: googleUser.email,
      refresh_token_ciphertext: await encryptSecret(token.refresh_token),
      scopes: (token.scope || GOOGLE_MEET_SCOPE).split(' ').filter(Boolean),
      status: 'active',
    }, { onConflict: 'community_id' })
    if (error) throw error
    return redirectResult(oauthState.return_path, 'connected', oauthState.community_id)
  } catch (error) {
    console.error('google-meet-oauth callback failed', error)
    return redirectResult(oauthState.return_path, 'error', oauthState.community_id)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'GET') return handleCallback(request)
  const preflight = options(request)
  if (preflight) return preflight
  const respond = (body: unknown, status = 200) => json(body, status, request)
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  try {
    const user = await getUser(request)
    if (!user) return respond({ error: 'Authentication required' }, 401)
    const limit = await enforceRateLimit(admin, request, 'google-meet-oauth', user.id, { windowSeconds: 600, maxRequests: 20 })
    if (!limit.allowed) return rateLimitResponse(limit, 'Demasiadas solicitudes para conectar Google Meet. Intenta nuevamente más tarde.', request)

    const parsed = await readJsonBody<{ action?: unknown; communityId?: unknown; returnPath?: unknown }>(request)
    if (parsed.tooLarge) return respond({ error: 'La solicitud es demasiado grande.' }, 413)
    if (parsed.invalid || !parsed.value) return respond({ error: 'La solicitud no es válida.' }, 400)
    const body = parsed.value
    const communityId = typeof body.communityId === 'string' ? body.communityId.trim() : ''
    if (!communityId || !(await canManageCommunity(user.id, communityId))) return respond({ error: 'No tienes permisos para conectar Google Meet en esta comunidad.' }, 403)

    const { data: connection, error: connectionError } = await admin.from('google_meet_connections').select('google_email,status').eq('community_id', communityId).maybeSingle()
    if (connectionError) return respond({ error: connectionError.message }, 500)
    if (body.action === 'status') return respond({ connected: connection?.status === 'active', email: connection?.google_email || null, status: connection?.status || null })
    if (connection?.status === 'active') return respond({ connected: true, email: connection.google_email })

    const rawState = randomToken()
    const { error: stateError } = await admin.from('google_meet_oauth_states').insert({
      state_hash: await sha256(rawState),
      user_id: user.id,
      community_id: communityId,
      return_path: safeReturnPath(body.returnPath),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (stateError) return respond({ error: stateError.message }, 500)
    return respond({ connected: false, authorizationUrl: authorizationUrl(rawState) })
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'No pudimos iniciar la conexión con Google.' }, 500)
  }
})
