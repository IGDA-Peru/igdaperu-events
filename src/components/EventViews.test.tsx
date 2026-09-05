import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { buildTimelineSegments, CalendarView, timelineRangeForMonth, TimelineView } from './EventViews'
import type { EventItem } from '../types'

const multiDayEvent: EventItem = {
  id: 'multi-day-event',
  slug: 'game-jam-de-semana',
  communityId: 'community-1',
  communityName: 'Comunidad de prueba',
  communitySlug: 'comunidad-de-prueba',
  title: 'Game jam de semana completa',
  description: 'Evento de prueba.',
  type: 'GAME JAM',
  startsAt: '2026-09-18T09:00:00-05:00',
  endsAt: '2026-09-22T09:00:00-05:00',
  isAllDay: false,
  timezone: 'America/Lima',
  locationType: 'venue',
  venueName: 'Lima, Perú',
  address: '',
  meetingUrl: '',
  visibility: 'public',
  status: 'published',
}

function timelineEvent(overrides: Partial<EventItem>): EventItem {
  return {
    ...multiDayEvent,
    id: 'timeline-event',
    slug: 'timeline-event',
    title: 'Evento de timeline',
    startsAt: '2026-09-08T09:00:00-05:00',
    endsAt: '2026-09-12T18:00:00-05:00',
    ...overrides,
  }
}

describe('CalendarView', () => {
  it('splits a multi-day event across week rows while preserving its span', () => {
    const onEventOpen = vi.fn()
    render(<MemoryRouter><CalendarView events={[multiDayEvent]} onEventOpen={onEventOpen} /></MemoryRouter>)

    const segments = screen.getAllByRole('button', { name: /Game jam de semana completa/ })
    expect(segments).toHaveLength(2)
    expect(segments[0]).toHaveStyle({ gridColumn: '5 / 8' })
    expect(segments[1]).toHaveStyle({ gridColumn: '1 / 3' })
    expect(segments[0]).toHaveClass('continues-after')
    expect(segments[1]).toHaveClass('continues-before')

    fireEvent.click(segments[0])
    expect(onEventOpen).toHaveBeenCalledWith(multiDayEvent)
  })
})

describe('TimelineView', () => {
  it('creates a weekly monthly range and separates overlapping events into lanes', () => {
    const range = timelineRangeForMonth(new Date('2026-09-01T12:00:00-05:00'))
    const segments = buildTimelineSegments([
      timelineEvent({ id: 'first', title: 'Primero' }),
      timelineEvent({ id: 'second', title: 'Superpuesto', startsAt: '2026-09-10T09:00:00-05:00', endsAt: '2026-09-11T18:00:00-05:00' }),
      timelineEvent({ id: 'third', title: 'Posterior', startsAt: '2026-09-15T09:00:00-05:00', endsAt: '2026-09-15T18:00:00-05:00' }),
    ], range)

    expect(range.startKey).toBe('2026-08-31')
    expect(range.endKey).toBe('2026-10-04')
    expect(segments.find((segment) => segment.event.id === 'first')?.lane).toBe(0)
    expect(segments.find((segment) => segment.event.id === 'second')?.lane).toBe(1)
    expect(segments.find((segment) => segment.event.id === 'third')?.lane).toBe(0)
    expect(segments.find((segment) => segment.event.id === 'third')?.isSingleDay).toBe(true)
    expect(segments.find((segment) => segment.event.id === 'third')?.endIndex).toBe(segments.find((segment) => segment.event.id === 'third')?.startIndex)
  })

  it('opens the shared preview and filters rows by community', () => {
    const onEventOpen = vi.fn()
    const first = timelineEvent({ id: 'first', title: 'Evento IGDA', communityId: 'igda', communityName: 'IGDA Perú' })
    const second = timelineEvent({ id: 'second', title: 'Evento Godot', communityId: 'godot', communityName: 'Godot Lima', startsAt: '2026-09-15T09:00:00-05:00', endsAt: '2026-09-15T18:00:00-05:00' })
    render(<MemoryRouter><TimelineView events={[first, second]} showVisibility onEventOpen={onEventOpen} /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /Evento IGDA/ }))
    expect(onEventOpen).toHaveBeenCalledWith(first)

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar timeline por comunidad' }), { target: { value: 'godot' } })
    expect(screen.queryByRole('button', { name: /Evento IGDA/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Evento Godot/ })).toBeInTheDocument()
  })

  it('paginates the month in sections of up to three weeks', () => {
    const first = timelineEvent({ id: 'first', title: 'Evento primera sección' })
    const later = timelineEvent({ id: 'later', title: 'Evento segunda sección', startsAt: '2026-09-25T09:00:00-05:00', endsAt: '2026-09-25T18:00:00-05:00' })
    render(<MemoryRouter><TimelineView events={[first, later]} showVisibility={false} onEventOpen={vi.fn()} /></MemoryRouter>)

    expect(screen.getByText('Parte 1 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sección anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente sección' }))
    expect(screen.getByText('Parte 2 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Evento segunda sección/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Evento primera sección/ })).not.toBeInTheDocument()
  })
})
