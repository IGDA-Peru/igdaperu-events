import { describe, expect, it, vi } from 'vitest'
import { createInvitation, deleteEvent } from './data'

const { invoke, from } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }))

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke }, from },
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

describe('deleteEvent', () => {
  it('requires the database delete to return the requested event', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { cover_path: null }, error: null })
    const readSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }))
    const deleteSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const deleteBuilder = { eq: vi.fn(() => ({ select: deleteSelect })) }
    from.mockReset()
    from.mockReturnValueOnce({ select: readSelect }).mockReturnValueOnce({ delete: vi.fn(() => deleteBuilder) })

    await expect(deleteEvent('event-id')).rejects.toThrow('no tengas permisos')
    expect(deleteSelect).toHaveBeenCalledWith('id')
  })
})
