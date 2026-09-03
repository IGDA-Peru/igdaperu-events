import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('public agenda', () => {
  it('shows the public agenda using the local demo fallback', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Agenda IGDA Perú' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Diseño de niveles/ }).length).toBeGreaterThan(0))
    expect(screen.getByText(/Vista de demostración/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Comunidades/ }).length).toBeGreaterThan(0)
  })
})
