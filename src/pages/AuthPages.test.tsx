import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RegisterPage } from './AuthPages'

describe('invite-only access', () => {
  it('does not expose a public registration form', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Acceso por invitación' })).toBeInTheDocument()
    expect(screen.getByText(/administrador debe enviarte una invitación/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ya tengo una cuenta' })).toHaveAttribute('href', '/login')
  })
})
