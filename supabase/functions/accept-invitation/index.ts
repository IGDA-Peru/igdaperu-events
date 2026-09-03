import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, corsHeaders, json, options, sha256 } from '../_shared/cors.ts'

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

    const body = await request.json()
    const token = String(body.token || '').trim()
    if (!token) return json({ error: 'Invitation token is required' }, 400)

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
