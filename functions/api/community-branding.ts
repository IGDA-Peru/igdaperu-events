type PagesContext<Env> = {
  request: Request
  env: Env
}

type CommunityBrandingEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_KEY?: string
}

type CommunityRow = {
  id?: string
  slug?: string
  logo_path?: string | null
  banner_path?: string | null
}

const COMMUNITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COMMUNITY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEGACY_BANNERS = new Map<string, string>([
  ['divgames', 'https://igda.pe/images/communities/divgames.png'],
  ['game-dev-friends', 'https://igda.pe/images/communities/game-dev-friends.png'],
  ['igda-peru', 'https://igda.pe/images/communities/igda-peru.png'],
])

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET',
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      'x-content-type-options': 'nosniff',
    },
  })
}

function getStorageUrl(path: string | null | undefined, communityId: string, kind: 'logo' | 'banner', supabaseUrl: string) {
  if (!path) return null

  const expectedName = new RegExp(`^${kind}-${ASSET_ID_PATTERN.source.slice(1, -1)}\\.webp$`, 'i')
  const [pathCommunityId, fileName, ...unexpectedSegments] = path.split('/')
  if (
    !COMMUNITY_ID_PATTERN.test(communityId)
    || pathCommunityId !== communityId
    || unexpectedSegments.length > 0
    || !expectedName.test(fileName || '')
  ) return null

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl}/storage/v1/object/public/community-assets/${encodedPath}`
}

export const onRequestGet = async ({ env }: PagesContext<CommunityBrandingEnv>) => {
  const supabaseUrl = env.SUPABASE_URL?.replace(/\/$/, '')
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    return jsonResponse({ error: 'El servicio de identidad visual no está configurado.' }, 500)
  }

  try {
    const communitiesUrl = new URL(`${supabaseUrl}/rest/v1/communities`)
    communitiesUrl.search = new URLSearchParams({
      select: 'id,slug,logo_path,banner_path',
      status: 'eq.approved',
      order: 'name.asc',
      limit: '200',
    }).toString()

    const upstream = await fetch(communitiesUrl, {
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${publishableKey}`,
        accept: 'application/json',
      },
    })
    if (!upstream.ok) return jsonResponse({ error: 'No pudimos cargar la identidad visual de las comunidades.' }, 502)

    const rows = await upstream.json() as CommunityRow[]
    const communities = rows.flatMap((row) => {
      const id = row.id || ''
      const slug = row.slug || ''
      if (!COMMUNITY_ID_PATTERN.test(id) || !COMMUNITY_SLUG_PATTERN.test(slug)) return []

      const legacyBanner = LEGACY_BANNERS.get(slug)
      const bannerUrl = row.banner_path === legacyBanner
        ? legacyBanner
        : getStorageUrl(row.banner_path, id, 'banner', supabaseUrl)

      return [{
        slug,
        logoUrl: getStorageUrl(row.logo_path, id, 'logo', supabaseUrl),
        bannerUrl,
      }]
    })

    return jsonResponse({ communities })
  } catch {
    return jsonResponse({ error: 'No pudimos cargar la identidad visual de las comunidades.' }, 502)
  }
}
