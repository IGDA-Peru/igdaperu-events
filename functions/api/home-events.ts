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
const eventSelect = 'id,slug,community_id,organizer_name,title,description,type,starts_at,ends_at,is_all_day,timezone,location_type,access_mode,location_precision,location_department,location_province,venue_name,address,map_url,formatted_address,meeting_url,meeting_provider,meeting_link_visibility,registration_url,cover_path,visibility,status,community:communities(name,slug,status,logo_path,brand_color)'

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
    select: communitySlug ? eventSelect.replace('community:communities(', 'community:communities!inner(') : eventSelect,
    status: 'eq.published',
    visibility: 'eq.public',
    starts_at: `gte.${new Date().toISOString()}`,
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

  const payload = await upstream.json() as unknown
  const filteredPayload = Array.isArray(payload)
    ? payload.filter((row) => {
      const community = (row as { community?: { status?: string } | null }).community
      return !community || community.status === 'approved'
    })
    : payload
  const response = new Response(JSON.stringify(filteredPayload), {
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
