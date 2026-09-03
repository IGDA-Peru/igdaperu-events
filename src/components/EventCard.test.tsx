import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { EventCard } from './EventCard'
import type { EventItem } from '../types'

const event: EventItem = {
  id: 'event-1',
  slug: 'evento-1',
  communityId: 'community-1',
  communityName: 'Comunidad de prueba',
  communitySlug: 'comunidad-de-prueba',
  title: 'Evento de prueba',
  description: 'Descripción del evento.',
  type: 'CHARLA',
  startsAt: '2026-09-19T19:00:00-05:00',
  endsAt: '2026-09-19T21:00:00-05:00',
  timezone: 'America/Lima',
  locationType: 'venue',
  venueName: 'Lima, Perú',
  address: '',
  meetingUrl: '',
  visibility: 'public',
  status: 'published',
}

describe('EventCard visibility', () => {
  it('distinguishes public and private events when requested', () => {
    const { container, rerender } = render(<MemoryRouter><EventCard event={event} showVisibility /></MemoryRouter>)

    expect(screen.getByText('Público')).toBeInTheDocument()
    expect(container.querySelector('.public-event')).toBeInTheDocument()

    rerender(<MemoryRouter><EventCard event={{ ...event, visibility: 'network' }} showVisibility /></MemoryRouter>)

    expect(screen.getByText('Privado')).toBeInTheDocument()
    expect(container.querySelector('.private-event')).toBeInTheDocument()
  })
})
