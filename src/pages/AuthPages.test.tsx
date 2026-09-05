import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import type { AuthContextValue } from '../auth/auth-context'
import { EditProfilePage, RegisterPage } from './AuthPages'

describe('invite-only access', () => {
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
})
