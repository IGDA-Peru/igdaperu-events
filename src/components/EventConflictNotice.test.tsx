import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventConflictNotice } from './EventConflictNotice'

const conflict = { id: 'event-1', title: 'Evento coincidente', communityName: 'Comunidad de prueba', startsAt: '2026-10-01T10:00:00-05:00', endsAt: '2026-10-01T12:00:00-05:00', isAllDay: false }

describe('EventConflictNotice', () => {
  it('shows the loading, clear and non-blocking warning states', () => {
    const { rerender } = render(<EventConflictNotice status="loading" conflicts={[]} hasMore={false} />)
    expect(screen.getByText(/Revisando si hay cruces/)).toBeInTheDocument()

    rerender(<EventConflictNotice status="ready" conflicts={[]} hasMore={false} />)
    expect(screen.getByText(/No encontramos eventos cruzados/)).toBeInTheDocument()

    rerender(<EventConflictNotice status="ready" conflicts={[conflict]} hasMore={false} />)
    expect(screen.getByText('Evento coincidente')).toBeInTheDocument()
    expect(screen.getByText(/Puedes continuar si el cruce es intencional/)).toBeInTheDocument()
  })

  it('explains that a lookup error does not block the editor', () => {
    render(<EventConflictNotice status="error" conflicts={[]} hasMore={false} error="Servicio no disponible." />)

    expect(screen.getByText('No pudimos revisar los cruces')).toBeInTheDocument()
    expect(screen.getByText(/Puedes continuar/)).toBeInTheDocument()
  })
})
