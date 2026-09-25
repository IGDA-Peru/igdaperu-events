type SyncAction = 'reserve' | 'activate'

export type GamesAccountSyncResult = {
  ok: boolean
  status: number
  errorCode?: string
}

export function isGamesAccountSyncConfigured() {
  return Boolean(Deno.env.get('GAMES_SUPABASE_URL') && Deno.env.get('GAMES_ACCOUNT_SYNC_SECRET'))
}

export async function syncGamesAccount(
  action: SyncAction,
  email: string,
  authUserId?: string,
): Promise<GamesAccountSyncResult> {
  const baseUrl = Deno.env.get('GAMES_SUPABASE_URL')?.replace(/\/$/, '')
  const secret = Deno.env.get('GAMES_ACCOUNT_SYNC_SECRET')
  if (!baseUrl || !secret) return { ok: false, status: 503, errorCode: 'sync_not_configured' }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/sync-event-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-events-account-sync-secret': secret,
      },
      body: JSON.stringify({ action, email, ...(authUserId ? { authUserId } : {}) }),
    })
    const result = await response.json().catch(() => ({}))
    return {
      ok: response.ok,
      status: response.status,
      errorCode: typeof result?.error === 'string' ? result.error : undefined,
    }
  } catch {
    return { ok: false, status: 503, errorCode: 'sync_unavailable' }
  }
}
