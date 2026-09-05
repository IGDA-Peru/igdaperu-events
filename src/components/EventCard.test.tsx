import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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
  isAllDay: false,
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

    expect(screen.queryByText('Público')).not.toBeInTheDocument()
    expect(container.querySelector('.public-event')).toBeInTheDocument()

    rerender(<MemoryRouter><EventCard event={{ ...event, visibility: 'network' }} showVisibility /></MemoryRouter>)

    expect(screen.getByText('Solo la red')).toBeInTheDocument()
    expect(container.querySelector('.private-event')).toBeInTheDocument()
  })

  it('uses panel state and management actions instead of event navigation', () => {
    const onArchive = vi.fn()
    const onDelete = vi.fn()
    render(<MemoryRouter><EventCard event={{ ...event, status: 'draft' }} compact panelActions={{ onArchive, onDelete }} /></MemoryRouter>)

    expect(screen.getByRole('link', { name: 'Editar Evento de prueba' })).toHaveAttribute('href', '/app/eventos/event-1')
    expect(screen.getByText('Borrador')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archivar Evento de prueba' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar Evento de prueba' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver Evento de prueba' })).not.toBeInTheDocument()
  })

  it('shows the effective audience for published panel events', () => {
    const { rerender } = render(<MemoryRouter><EventCard event={event} compact panelActions={{ onArchive: vi.fn(), onDelete: vi.fn() }} /></MemoryRouter>)

    expect(screen.getByText('Público')).toBeInTheDocument()
    expect(screen.queryByText('CHARLA')).not.toBeInTheDocument()

    rerender(<MemoryRouter><EventCard event={{ ...event, visibility: 'network' }} compact panelActions={{ onArchive: vi.fn(), onDelete: vi.fn() }} /></MemoryRouter>)

    expect(screen.getByText('Solo la red')).toBeInTheDocument()
  })

  it('shows the creator email only in managed event cards', () => {
    const managedEvent = { ...event, creatorEmail: 'editor@comunidad.pe' }
    const { rerender } = render(<MemoryRouter><EventCard event={managedEvent} compact panelActions={{ onArchive: vi.fn(), onDelete: vi.fn() }} /></MemoryRouter>)

    expect(screen.getByText('Creado por editor@comunidad.pe')).toBeInTheDocument()

    rerender(<MemoryRouter><EventCard event={managedEvent} /></MemoryRouter>)
    expect(screen.queryByText('Creado por editor@comunidad.pe')).not.toBeInTheDocument()
  })

  it('keeps the banner in a dedicated column and does not reserve one when absent', () => {
    const { container, rerender } = render(<MemoryRouter><EventCard event={{ ...event, coverPath: '/banners/event-1.jpg' }} /></MemoryRouter>)

    expect(container.querySelector('.event-row.has-cover')).toBeInTheDocument()
    expect(container.querySelector('.event-card-cover')).toHaveAttribute('src', '/banners/event-1.jpg')

    rerender(<MemoryRouter><EventCard event={event} /></MemoryRouter>)

    expect(container.querySelector('.event-row.has-cover')).not.toBeInTheDocument()
    expect(container.querySelector('.event-card-cover')).not.toBeInTheDocument()
  })

  it('calls archive and delete actions from the panel card', () => {
    const onArchive = vi.fn()
    const onDelete = vi.fn()
    render(<MemoryRouter><EventCard event={event} compact panelActions={{ onArchive, onDelete }} /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Archivar Evento de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Evento de prueba' }))

    expect(onArchive).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('marks completed events without hiding them', () => {
    render(<MemoryRouter><EventCard event={{ ...event, startsAt: '2026-08-19T19:00:00-05:00', endsAt: '2026-08-19T21:00:00-05:00' }} /></MemoryRouter>)

    expect(screen.getByText('Ya pasó')).toBeInTheDocument()
    expect(document.querySelector('.past-event')).toBeInTheDocument()
  })
})
