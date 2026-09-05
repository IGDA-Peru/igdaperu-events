import { describe, expect, it, vi } from 'vitest'
import { createInvitation } from './data'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke } },
}))

describe('createInvitation', () => {
  it('surfaces the Edge Function error instead of the generic non-2xx message', async () => {
    const context = new Response(JSON.stringify({ error: 'No pudimos enviar el correo de invitación: Email rate limit exceeded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context } })

    await expect(createInvitation('person@example.com', 'community-id', 'community_admin')).rejects.toThrow('Email rate limit exceeded')
    expect(invoke).toHaveBeenCalledWith('create-invitation', {
      body: { email: 'person@example.com', communityId: 'community-id', role: 'community_admin' },
    })
  })
})
