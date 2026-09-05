import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, json, options } from '../_shared/cors.ts'
import { createGoogleMeetSpace, decryptSecret, refreshGoogleAccessToken } from '../_shared/google-meet.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function canManageEvent(userId: string, communityId: string) {
  const [{ data: platform }, { data: membership }] = await Promise.all([
    admin.from('memberships').select('role').eq('user_id', userId).is('community_id', null).eq('role', 'platform_admin').eq('status', 'active').maybeSingle(),
    admin.from('memberships').select('role').eq('user_id', userId).eq('community_id', communityId).eq('status', 'active').in('role', ['community_editor', 'community_admin']).maybeSingle(),
  ])
  return Boolean(platform || membership)
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

    const body = await request.json().catch(() => ({})) as { eventId?: string }
    const eventId = String(body.eventId || '')
    if (!eventId) return json({ error: 'eventId es obligatorio' }, 400)

    const { data: event, error: eventError } = await admin.from('events').select('id,community_id,meeting_provider,meeting_url,meeting_connection_id').eq('id', eventId).maybeSingle()
    if (eventError || !event) return json({ error: eventError?.message || 'Evento no encontrado' }, 404)
    if (!(await canManageEvent(authData.user.id, event.community_id)) || event.meeting_provider !== 'google_meet') return json({ error: 'No tienes permisos para crear el enlace de este evento.' }, 403)
    if (event.meeting_url) return json({ meetingUrl: event.meeting_url, reused: true })

    const { data: connection, error: connectionError } = await admin.from('google_meet_connections').select('id,google_email,refresh_token_ciphertext,status').eq('community_id', event.community_id).eq('status', 'active').maybeSingle()
    if (connectionError || !connection) return json({ error: 'Conecta primero una cuenta de Google Meet para esta comunidad.' }, 409)

    let googleAccessToken: string
    try {
      const refreshToken = await decryptSecret(connection.refresh_token_ciphertext)
      const token = await refreshGoogleAccessToken(refreshToken)
      googleAccessToken = token.access_token!
    } catch (error) {
      await admin.from('google_meet_connections').update({ status: 'error' }).eq('id', connection.id)
      throw new Error(error instanceof Error ? error.message : 'No pudimos renovar la autorización de Google.')
    }

    const space = await createGoogleMeetSpace(googleAccessToken)
    const { error: updateError } = await admin.from('events').update({ meeting_provider: 'google_meet', meeting_url: space.meetingUri, meeting_external_id: space.name, meeting_connection_id: connection.id }).eq('id', event.id)
    if (updateError) throw updateError
    return json({ meetingUrl: space.meetingUri, provider: 'google_meet', googleEmail: connection.google_email, reused: false })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No pudimos crear el enlace de Google Meet.' }, 500)
  }
})
