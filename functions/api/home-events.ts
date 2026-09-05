type PagesContext<Env> = {
  request: Request
  env: Env
  waitUntil: (promise: Promise<unknown>) => void
}

type HomeEventsEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
}

const CACHE_CONTROL = 'public, max-age=60, s-maxage=120'
const eventSelect = 'id,slug,community_id,title,description,type,starts_at,ends_at,is_all_day,timezone,location_type,venue_name,address,map_url,formatted_address,meeting_url,meeting_provider,cover_path,visibility,status,community:communities!inner(name,slug,status,logo_path)'

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  })
}

function cacheResponse(response: Response, status: 'HIT' | 'MISS') {
  const headers = new Headers(response.headers)
  headers.set('x-home-events-cache', status)
  return new Response(response.body, { status: response.status, headers })
}

export const onRequestGet = async ({ request, env, waitUntil }: PagesContext<HomeEventsEnv>) => {
  const requestUrl = new URL(request.url)
  const communitySlug = requestUrl.searchParams.get('community') || ''
  if (communitySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(communitySlug)) {
    return jsonResponse({ error: 'La comunidad no es válida.' }, 400)
  }

  const cacheUrl = new URL(request.url)
  cacheUrl.pathname = '/api/home-events'
  cacheUrl.search = communitySlug ? `community=${encodeURIComponent(communitySlug)}` : ''
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })
  const cacheStorage = (globalThis as unknown as { caches?: { default?: Cache } }).caches
  const cache = cacheStorage?.default
  const cached = cache ? await cache.match(cacheKey) : undefined
  if (cached) return cacheResponse(cached, 'HIT')

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return jsonResponse({ error: 'La caché de eventos no está configurada.' }, 500)
  }

  const upstreamUrl = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/events`)
  upstreamUrl.search = new URLSearchParams({
    select: eventSelect,
    status: 'eq.published',
    visibility: 'eq.public',
    starts_at: `gte.${new Date().toISOString()}`,
    'community.status': 'eq.approved',
    order: 'starts_at.asc',
    limit: '3',
    ...(communitySlug ? { 'community.slug': `eq.${communitySlug}` } : {}),
  }).toString()

  const upstream = await fetch(upstreamUrl, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      accept: 'application/json',
    },
  })
  if (!upstream.ok) return jsonResponse({ error: 'No pudimos cargar los próximos eventos.' }, 502)

  const response = new Response(await upstream.text(), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
    },
  })
  if (cache) waitUntil(cache.put(cacheKey, response.clone()))
  return cacheResponse(response, 'MISS')
}
