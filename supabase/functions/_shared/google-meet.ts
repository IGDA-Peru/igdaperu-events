const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_MEET_API_URL = 'https://meet.googleapis.com/v2/spaces'

export const GOOGLE_MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created'
export const GOOGLE_MEET_OAUTH_SCOPES = `openid email ${GOOGLE_MEET_SCOPE}`

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type GoogleUserInfo = {
  sub?: string
  email?: string
  email_verified?: boolean
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Falta configurar el secret ${name}`)
  return value
}

export function googleClientId() {
  return requiredSecret('GOOGLE_OAUTH_CLIENT_ID')
}

export function googleClientSecret() {
  return requiredSecret('GOOGLE_OAUTH_CLIENT_SECRET')
}

export function googleRedirectUri() {
  return Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI')?.trim()
    || `${requiredSecret('SUPABASE_URL')}/functions/v1/google-meet-oauth`
}

export function appUrl() {
  return (Deno.env.get('APP_URL') || 'http://localhost:5173').replace(/\/$/, '')
}

export function safeReturnPath(value: unknown) {
  const path = typeof value === 'string' ? value.trim() : ''
  return path.startsWith('/app/') && !path.includes('://') ? path : '/app/eventos/nuevo'
}

function base64Url(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(normalized)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function encryptionKey() {
  const secret = requiredSecret('GOOGLE_TOKEN_ENCRYPTION_KEY')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await encryptionKey()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
  const packed = new Uint8Array(iv.length + ciphertext.byteLength)
  packed.set(iv)
  packed.set(new Uint8Array(ciphertext), iv.length)
  return base64Url(packed)
}

export async function decryptSecret(value: string) {
  const packed = fromBase64Url(value)
  const iv = packed.slice(0, 12)
  const ciphertext = packed.slice(12)
  const key = await encryptionKey()
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

export function authorizationUrl(state: string) {
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', googleClientId())
  url.searchParams.set('redirect_uri', googleRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_MEET_OAUTH_SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', state)
  return url.toString()
}

async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      ...parameters,
    }),
  })
  const result = await response.json().catch(() => ({})) as GoogleTokenResponse
  if (!response.ok || !result.access_token) throw new Error(result.error_description || result.error || 'Google no entregó un token válido.')
  return result
}

export function exchangeAuthorizationCode(code: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: googleRedirectUri() })
}

export function refreshGoogleAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

export async function googleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  const result = await response.json().catch(() => ({})) as GoogleUserInfo
  if (!response.ok || !result.sub || !result.email) throw new Error('No pudimos identificar la cuenta de Google autorizada.')
  return result
}

export async function createGoogleMeetSpace(accessToken: string) {
  const response = await fetch(GOOGLE_MEET_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const result = await response.json().catch(() => ({})) as { name?: string; meetingUri?: string; meetingCode?: string; error?: { message?: string } }
  if (!response.ok || !result.meetingUri) throw new Error(result.error?.message || 'Google no pudo crear el espacio de Meet.')
  return result
}
