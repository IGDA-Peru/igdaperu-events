type PagesContext<Env> = {
  request: Request
  env: Env
  waitUntil: (promise: Promise<unknown>) => void
}

type PublicCommunitiesEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
}

const CACHE_CONTROL = 'public, max-age=300, s-maxage=600'
const communitySelect = 'id,slug,name,description,logo_path,website_url,discord_url,status'

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
  headers.set('x-public-communities-cache', status)
  return new Response(response.body, { status: response.status, headers })
}

export const onRequestGet = async ({ request, env, waitUntil }: PagesContext<PublicCommunitiesEnv>) => {
  const cacheKey = new Request(new URL('/api/public-communities', request.url), { method: 'GET' })
  const cacheStorage = (globalThis as unknown as { caches?: { default?: Cache } }).caches
  const cache = cacheStorage?.default
  const cached = cache ? await cache.match(cacheKey) : undefined
  if (cached) return cacheResponse(cached, 'HIT')

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return jsonResponse({ error: 'La caché pública de comunidades no está configurada.' }, 500)

  const upstreamUrl = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/communities`)
  upstreamUrl.search = new URLSearchParams({
    select: communitySelect,
    status: 'eq.approved',
    order: 'name.asc',
    limit: '200',
  }).toString()

  const upstream = await fetch(upstreamUrl, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      accept: 'application/json',
    },
  })
  if (!upstream.ok) return jsonResponse({ error: 'No pudimos cargar las comunidades.' }, 502)

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
