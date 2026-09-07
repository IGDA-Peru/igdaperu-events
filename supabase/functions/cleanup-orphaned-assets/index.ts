import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { bearerToken, json, options } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const buckets = ['community-assets', 'event-assets'] as const

async function isPlatformAdmin(accessToken: string) {
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
  if (authError || !authData.user) return false
  const { data, error } = await admin
    .from('memberships')
    .select('role')
    .eq('user_id', authData.user.id)
    .is('community_id', null)
    .eq('role', 'platform_admin')
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

Deno.serve(async (request) => {
  const preflight = options(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const cronSecret = Deno.env.get('ASSET_CLEANUP_CRON_SECRET')
    const cronAuthorized = Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret)
    if (!cronAuthorized) {
      const accessToken = bearerToken(request)
      if (!accessToken || !(await isPlatformAdmin(accessToken))) return json({ error: 'Solo un administrador de IGDA puede limpiar archivos.' }, 403)
    }

    const body = await request.json().catch(() => ({})) as { dryRun?: boolean; minAgeHours?: number }
    const dryRun = Boolean(body.dryRun)
    const minAgeHours = Math.min(720, Math.max(24, Number(body.minAgeHours) || 24))
    const minAge = `${minAgeHours} hours`
    const result = { dryRun, minAgeHours, candidates: 0, deleted: 0, errors: [] as Array<{ bucket: string; message: string }> }

    for (const bucket of buckets) {
      const { data, error } = await admin.rpc('list_orphaned_asset_paths', { p_bucket_id: bucket, p_min_age: minAge })
      if (error) throw error
      const names = (data || []).map((row: { name: string }) => row.name).filter(Boolean)
      result.candidates += names.length
      if (dryRun) continue
      for (const batch of chunks(names, 100)) {
        const { data: removed, error: removeError } = await admin.storage.from(bucket).remove(batch)
        if (removeError) {
          result.errors.push({ bucket, message: removeError.message })
          continue
        }
        result.deleted += removed?.length || batch.length
      }
    }

    return json(result)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No pudimos limpiar los archivos huérfanos.' }, 500)
  }
})
