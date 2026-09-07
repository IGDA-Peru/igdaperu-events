import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  updateProfileIdentity: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../lib/data', () => ({ updateProfileIdentity: mocks.updateProfileIdentity }))
vi.mock('../lib/supabase', () => ({
  appUrl: 'https://eventos.igda.pe',
  isSupabaseConfigured: false,
  supabase: { auth: { updateUser: mocks.updateUser }, functions: { invoke: mocks.invoke } },
}))

import { AcceptInvitationPage, EditProfilePage, RegisterPage } from './AuthPages'

describe('invite-only access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateProfileIdentity.mockResolvedValue(undefined)
    mocks.invoke.mockResolvedValue({ data: { communityId: 'community-1', role: 'community_admin' }, error: null })
  })

  it('does not expose a public registration form', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Acceso por invitación' })).toBeInTheDocument()
    expect(screen.getByText(/administrador debe enviarte una invitación/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ya tengo una cuenta' })).toHaveAttribute('href', '/login')
  })

  it('shows an editable identity with optional last names', () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'editor@comunidad.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Ana Torres', firstName: 'Ana', lastName: 'Torres' },
      memberships: [],
      roles: [],
      signOut: async () => {},
      refreshUserData: async () => {},
    } satisfies AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter><EditProfilePage /></MemoryRouter></AuthContext.Provider>)

    expect(screen.getByRole('heading', { name: 'Editar perfil' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombres')).toHaveValue('Ana')
    expect(screen.getByLabelText(/Apellidos/)).toHaveValue('Torres')
    expect(screen.getByLabelText(/Apellidos/)).not.toBeRequired()
  })

  it('accepts an invitation when the resent account already has the same password', async () => {
    mocks.updateUser
      .mockResolvedValueOnce({ data: null, error: { code: 'same_password', message: 'New password should be different from the old password.' } })
      .mockResolvedValueOnce({ data: null, error: null })
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'borferkic@gmail.com' } as NonNullable<AuthContextValue['user']>,
      profile: null,
      memberships: [],
      roles: [],
      signOut: async () => {},
      refreshUserData: async () => {},
    } satisfies AuthContextValue
    const user = userEvent.setup()

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/invitaciones/token-1']}><Routes><Route path="/invitaciones/:token" element={<AcceptInvitationPage />} /></Routes></MemoryRouter></AuthContext.Provider>)

    await user.type(screen.getByLabelText('Nombres'), 'Boris')
    await user.type(screen.getByLabelText('Apellidos'), 'Fernandez')
    await user.type(screen.getByLabelText('Contraseña nueva o actual'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Aceptar invitación' }))

    await waitFor(() => expect(screen.getByText('Invitación aceptada. Ya puedes gestionar eventos.')).toBeInTheDocument())
    expect(mocks.updateUser).toHaveBeenNthCalledWith(2, { data: { first_name: 'Boris', last_name: 'Fernandez', display_name: 'Boris Fernandez' } })
    expect(mocks.invoke).toHaveBeenCalledWith('accept-invitation', { body: { token: 'token-1', turnstileToken: '' } })
  })
})
