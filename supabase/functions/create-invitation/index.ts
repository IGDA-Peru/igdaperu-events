import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, corsHeaders, json, options, randomToken, sha256 } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const appUrl = (Deno.env.get('APP_URL') || 'http://localhost:5173').replace(/\/$/, '')
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
    const email = String(body.email || '').trim().toLowerCase()
    const communityId = String(body.communityId || '')
    const role = body.role === 'community_admin' ? 'community_admin' : body.role === 'community_editor' ? 'community_editor' : null
    if (!email || !email.includes('@') || !communityId || !role) return json({ error: 'Email, comunidad y rol son obligatorios' }, 400)

    const [{ data: platformMembership }, { data: communityMembership }, { data: community }] = await Promise.all([
      admin.from('memberships').select('role').eq('user_id', authData.user.id).is('community_id', null).eq('role', 'platform_admin').eq('status', 'active').maybeSingle(),
      admin.from('memberships').select('role').eq('user_id', authData.user.id).eq('community_id', communityId).eq('status', 'active').maybeSingle(),
      admin.from('communities').select('status').eq('id', communityId).maybeSingle(),
    ])

    if (!community || community.status !== 'approved') return json({ error: 'La comunidad no está aprobada' }, 400)
    const isPlatformAdmin = platformMembership?.role === 'platform_admin'
    const isCommunityAdmin = communityMembership?.role === 'community_admin'
    if (!isPlatformAdmin && !isCommunityAdmin) return json({ error: 'No tienes permisos para invitar en esta comunidad' }, 403)
    if (!isPlatformAdmin && role !== 'community_editor') return json({ error: 'Un administrador de comunidad solo puede invitar editores' }, 403)

    const rawToken = randomToken()
    const tokenHash = await sha256(rawToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: invitation, error: insertError } = await admin.from('invitations').insert({
      community_id: communityId,
      email,
      role,
      token_hash: tokenHash,
      invited_by: authData.user.id,
      expires_at: expiresAt,
    }).select('id').single()
    if (insertError || !invitation) return json({ error: insertError?.message || 'No pudimos crear la invitación' }, 400)

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/invitaciones/${rawToken}`,
    })
    if (inviteError) {
      await admin.from('invitations').delete().eq('id', invitation.id)
      return json({ error: inviteError.message }, 400)
    }

    await admin.from('audit_log').insert({ actor_id: authData.user.id, action: 'invitation.created', entity_type: 'invitation', entity_id: invitation.id, metadata: { community_id: communityId, role } })
    return new Response(JSON.stringify({ inviteUrl: `${appUrl}/invitaciones/${rawToken}`, expiresAt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
