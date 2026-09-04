const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

type ServiceAccount = {
  client_email?: string
  private_key?: string
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToBytes(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function getGoogleAccessToken(serviceAccount: ServiceAccount, scope: string) {
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('La credencial de Google no contiene client_email o private_key')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.private_key.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  const assertion = `${header}.${payload}.${base64Url(new Uint8Array(signature))}`
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const result = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string }
  if (!response.ok || !result.access_token) {
    throw new Error(`Google no entregó un token de acceso (${response.status}): ${result.error_description || 'respuesta no válida'}`)
  }
  return result.access_token
}

export async function readServiceAccountSecret() {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!raw) throw new Error('Falta el secret GOOGLE_SERVICE_ACCOUNT_JSON')
  try {
    return JSON.parse(raw) as ServiceAccount
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON válido')
  }
}
