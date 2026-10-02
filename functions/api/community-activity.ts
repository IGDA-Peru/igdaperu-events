type PagesContext<Env> = {
  request: Request
  env: Env
  waitUntil: (promise: Promise<unknown>) => void
}

type CommunityActivityEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
}

type ActivityRow = {
  ends_at?: string | null
  community?: { slug?: string | null } | null
}

const CACHE_CONTROL = 'public, max-age=60, s-maxage=120'
const RECENT_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const COMMUNITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET',
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  })
}

function cacheResponse(response: Response, status: 'HIT' | 'MISS') {
  const headers = new Headers(response.headers)
  headers.set('x-community-activity-cache', status)
  return new Response(response.body, { status: response.status, headers })
}

export const onRequestGet = async ({ request, env, waitUntil }: PagesContext<CommunityActivityEnv>) => {
  const cacheKey = new Request(new URL('/api/community-activity', request.url), { method: 'GET' })
  const cacheStorage = (globalThis as unknown as { caches?: { default?: Cache } }).caches
  const cache = cacheStorage?.default
  const cached = cache ? await cache.match(cacheKey) : undefined
  if (cached) return cacheResponse(cached, 'HIT')

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return jsonResponse({ error: 'La actividad de comunidades no está configurada.' }, 500)
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - RECENT_ACTIVITY_WINDOW_MS)
  const upstreamUrl = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/events`)
  upstreamUrl.search = new URLSearchParams({
    select: 'ends_at,community:communities!inner(slug)',
    status: 'in.(published,archived)',
    visibility: 'eq.public',
    and: `(ends_at.gte.${cutoff.toISOString()},ends_at.lt.${now.toISOString()})`,
    'community.status': 'eq.approved',
    order: 'ends_at.desc',
    limit: '200',
  }).toString()

  const upstream = await fetch(upstreamUrl, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      accept: 'application/json',
    },
  })
  if (!upstream.ok) return jsonResponse({ error: 'No pudimos cargar la actividad de las comunidades.' }, 502)

  const payload = await upstream.json() as unknown
  const rows = Array.isArray(payload) ? payload as ActivityRow[] : []
  const latestByCommunity = new Map<string, string>()
  for (const row of rows) {
    const slug = row.community?.slug || ''
    const latestEventAt = row.ends_at || ''
    if (!COMMUNITY_SLUG_PATTERN.test(slug) || !latestEventAt || latestByCommunity.has(slug)) continue
    latestByCommunity.set(slug, latestEventAt)
  }

  const response = jsonResponse({
    communities: [...latestByCommunity].map(([slug, latestEventAt]) => ({ slug, latestEventAt })),
  }, 200, { 'cache-control': CACHE_CONTROL })
  if (cache) waitUntil(cache.put(cacheKey, response.clone()))
  return cacheResponse(response, 'MISS')
}
