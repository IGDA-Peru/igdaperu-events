const turnstileVerifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function requestIp(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

/** Verifies a Turnstile token without exposing the secret to the client. */
export async function verifyTurnstile(token: string, request: Request, expectedAction: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET') || ''
  const expectedHostnames = new Set((Deno.env.get('TURNSTILE_HOSTNAMES') || '').split(',').map((value) => value.trim()).filter(Boolean))
  if (!secret || expectedHostnames.size === 0 || token.length === 0 || token.length > 2048) return false

  const body = new URLSearchParams({ secret, response: token, remoteip: requestIp(request) })
  try {
    const response = await fetch(turnstileVerifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: boolean; action?: string; hostname?: string }
    return result.success === true && result.action === expectedAction && Boolean(result.hostname && expectedHostnames.has(result.hostname))
  } catch {
    return false
  }
}
