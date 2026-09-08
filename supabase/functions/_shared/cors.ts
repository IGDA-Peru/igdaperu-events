const productionOrigin = 'https://eventos.igda.pe'
const configuredOrigins = (Deno.env.get('CORS_ALLOWED_ORIGIN') || Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_URL') || productionOrigin)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter((origin) => /^https?:\/\/[^\s/]+$/i.test(origin))
const allowedOrigins = new Set([productionOrigin, ...configuredOrigins])

function corsHeadersFor(request?: Request) {
  const requestOrigin = request?.headers.get('Origin')?.replace(/\/$/, '')
  const allowedOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigins[0] || productionOrigin
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export const corsHeaders = corsHeadersFor()

export function json(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(request), 'Content-Type': 'application/json' },
  })
}

export function options(request: Request) {
  return request.method === 'OPTIONS' ? new Response('ok', { headers: corsHeadersFor(request) }) : null
}

export async function readJsonBody<T>(request: Request, maxBytes = 16 * 1024): Promise<{ value: T | null; tooLarge: boolean; invalid: boolean }> {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > maxBytes) return { value: null, tooLarge: true, invalid: false }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return { value: null, tooLarge: true, invalid: false }
  if (!raw.trim()) return { value: null, tooLarge: false, invalid: true }
  try {
    return { value: JSON.parse(raw) as T, tooLarge: false, invalid: false }
  } catch {
    return { value: null, tooLarge: false, invalid: true }
  }
}

export function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
