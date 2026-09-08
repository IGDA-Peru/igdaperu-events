import { json, sha256 } from './cors.ts'

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

type RateLimitConfig = {
  windowSeconds: number
  maxRequests: number
}

export type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds?: number
  storageError?: string
}

export function rateLimitResponse(result: RateLimitResult, message = 'Demasiadas solicitudes. Intenta nuevamente más tarde.', request?: Request) {
  if (result.storageError) return json({ error: 'No pudimos verificar el límite de solicitudes. Intenta nuevamente.' }, 503, request)
  const response = json({ error: message }, 429, request)
  response.headers.set('Retry-After', String(result.retryAfterSeconds || 60))
  return response
}

function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('cf-connecting-ip') || forwarded || request.headers.get('x-real-ip') || 'unknown'
}

async function consume(admin: RpcClient, bucket: string, subject: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc('consume_function_rate_limit', {
    p_bucket: bucket,
    p_subject_hash: await sha256(subject),
    p_window_seconds: config.windowSeconds,
    p_max_requests: config.maxRequests,
  })
  if (error) return { allowed: false, storageError: error.message || 'No pudimos verificar el límite de solicitudes.' }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return { allowed: false, storageError: 'La respuesta del límite de solicitudes no es válida.' }
  const result = row as { allowed?: unknown; retry_after_seconds?: unknown }
  if (result.allowed !== true) return { allowed: false, retryAfterSeconds: Math.max(1, Number(result.retry_after_seconds) || config.windowSeconds) }
  return { allowed: true }
}

export async function enforceRateLimit(admin: RpcClient, request: Request, bucket: string, userId: string | null, config: RateLimitConfig): Promise<RateLimitResult> {
  const subjects = userId ? [`user:${userId}`, `ip:${requestIp(request)}`] : [`ip:${requestIp(request)}`]
  for (const subject of subjects) {
    const result = await consume(admin, bucket, subject, config)
    if (!result.allowed) return result
  }
  return { allowed: true }
}
