type PagesContext<Env> = {
  request: Request
  env: Env
  params: { slug?: string }
  waitUntil: (promise: Promise<unknown>) => void
}

type CommunityBannerEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
}

const CACHE_CONTROL = 'public, max-age=0, s-maxage=60'
const COMMUNITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LEGACY_BANNERS = new Map<string, string>([
  ['divgames', '/images/communities/divgames.png'],
  ['game-dev-friends', '/images/communities/game-dev-friends.png'],
  ['igda-peru', '/images/communities/igda-peru.png'],
])

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function cacheResponse(response: Response, status: 'HIT' | 'MISS') {
  const headers = new Headers(response.headers)
  headers.set('x-community-banner-cache', status)
  return new Response(response.body, { status: response.status, headers })
}

export const onRequestGet = async ({ request, env, params, waitUntil }: PagesContext<CommunityBannerEnv>) => {
  const slug = params.slug?.toLowerCase() || ''
  if (!COMMUNITY_SLUG_PATTERN.test(slug)) return errorResponse('La comunidad no es válida.', 400)
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return errorResponse('El servicio de banners de comunidades no está configurado.', 500)
  }

  const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, '')
  const cacheKey = new Request(new URL(`/api/community-banner/${slug}`, request.url), { method: 'GET' })
  const cacheStorage = (globalThis as unknown as { caches?: { default?: Cache } }).caches
  const cache = cacheStorage?.default
  const cached = cache ? await cache.match(cacheKey) : undefined
  if (cached) return cacheResponse(cached, 'HIT')

  try {
    const communityUrl = new URL(`${supabaseUrl}/rest/v1/communities`)
    communityUrl.search = new URLSearchParams({
      select: 'id,banner_path',
      slug: `eq.${slug}`,
      status: 'eq.approved',
      limit: '1',
    }).toString()

    const communityResponse = await fetch(communityUrl, {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        accept: 'application/json',
      },
    })
    if (!communityResponse.ok) return errorResponse('No pudimos cargar el banner de la comunidad.', 502)

    const communities = await communityResponse.json() as Array<{ id?: string; banner_path?: string | null }>
    const community = communities[0]
    const bannerPath = community?.banner_path
    if (!community?.id || !bannerPath) return errorResponse('La comunidad no tiene un banner publicado.', 404)

    const legacyPath = LEGACY_BANNERS.get(slug)
    if (legacyPath && bannerPath === `https://igda.pe${legacyPath}`) {
      const legacyResponse = await fetch(bannerPath, { redirect: 'error' })
      if (!legacyResponse.ok) {
        return legacyResponse.status === 404
          ? errorResponse('El archivo del banner no existe.', 404)
          : errorResponse('No pudimos cargar el archivo del banner.', 502)
      }

      const contentType = legacyResponse.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (contentType !== 'image/png') return errorResponse('El archivo del banner no es válido.', 502)

      const response = new Response(legacyResponse.body, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'cache-control': CACHE_CONTROL,
          'x-content-type-options': 'nosniff',
        },
      })
      if (cache) waitUntil(cache.put(cacheKey, response.clone()))
      return cacheResponse(response, 'MISS')
    }

    // Los banners creados por la app siguen el formato UUID/banner-{UUID}.webp.
    const [communityId, fileName, ...unexpectedSegments] = bannerPath.split('/')
    if (
      communityId !== community.id
      || unexpectedSegments.length > 0
      || !/^banner-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(fileName || '')
    ) {
      return errorResponse('El banner de la comunidad no es válido.', 404)
    }

    const storagePath = bannerPath.split('/').map(encodeURIComponent).join('/')
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/community-assets/${storagePath}`
    const storageResponse = await fetch(storageUrl)
    if (!storageResponse.ok) {
      return storageResponse.status === 404
        ? errorResponse('El archivo del banner no existe.', 404)
        : errorResponse('No pudimos cargar el archivo del banner.', 502)
    }

    const contentType = storageResponse.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
    if (contentType !== 'image/webp') return errorResponse('El archivo del banner no es válido.', 502)

    const response = new Response(storageResponse.body, {
      status: 200,
      headers: {
        'content-type': 'image/webp',
        'cache-control': CACHE_CONTROL,
        'x-content-type-options': 'nosniff',
      },
    })
    if (cache) waitUntil(cache.put(cacheKey, response.clone()))
    return cacheResponse(response, 'MISS')
  } catch {
    return errorResponse('No pudimos cargar el banner de la comunidad.', 502)
  }
}
