import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./lib/supabase', () => ({
  appUrl: 'http://localhost:5173',
  isSupabaseConfigured: false,
  supabase: null,
}))

describe('public events', () => {
  it('shows public events using the local demo fallback', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Agenda IGDA Perú' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tiempo' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lugar' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lugar' })).toHaveValue('all')
    expect(screen.queryByRole('option', { name: 'Todos los departamentos del Perú' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Internacional' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lima' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Diseño de niveles/ }).length).toBeGreaterThan(0))
    expect(screen.getByText(/Vista de demostración/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Comunidades/ }).length).toBeGreaterThan(0)
  })
})
