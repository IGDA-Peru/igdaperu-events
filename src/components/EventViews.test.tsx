import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { buildTimelineSegments, CalendarView, EventResults, EventViewSwitcher, timelineRangeForMonth, timelineSingleDayLabelLayouts, TimelineView } from './EventViews'
import { findNextEventAfter, findPreviousEventBefore } from '../lib/eventFocus'
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
    expect(screen.queryByRole('heading', { name: multiDayEvent.title })).not.toBeInTheDocument()
  })

  it('shows single-day events as compact bars with hover preview and opens the parent popup on click', () => {
    const onEventOpen = vi.fn()
    const singleDayEvent = { ...multiDayEvent, id: 'single-day-event', title: 'Taller de prueba', startsAt: '2026-09-19T09:00:00-05:00', endsAt: '2026-09-19T12:00:00-05:00', coverPath: '/banners/taller.jpg', communityColor: '#659b3c' }
    const { container } = render(<MemoryRouter><CalendarView events={[singleDayEvent]} onEventOpen={onEventOpen} /></MemoryRouter>)

    const card = screen.getByRole('button', { name: /Taller de prueba/ })
    expect(card).toHaveClass('single-day')
    expect(card).toHaveStyle({ '--community-color': '#659b3c' })
    expect(card.querySelector('.community-logo')).toHaveStyle({ '--community-color': '#659b3c' })
    expect(card).not.toHaveClass('calendar-event-card')
    expect(card.querySelector('.calendar-event-card-media')).not.toBeInTheDocument()
    expect(card.querySelector('.calendar-event-hover-card')).toBeInTheDocument()

    fireEvent.click(card)
    expect(onEventOpen).toHaveBeenCalledWith(singleDayEvent)
    expect(container.querySelector('.calendar-event-dropdown')).not.toBeInTheDocument()
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
    const view = render(<MemoryRouter><TimelineView events={[first, second]} showVisibility onEventOpen={onEventOpen} communityFilter="all" /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /Evento IGDA/ }))
    expect(onEventOpen).toHaveBeenCalledWith(first)
    expect(screen.getByRole('button', { name: /Evento IGDA/ }).querySelector('.calendar-event-hover-card')).toBeInTheDocument()

    view.rerender(<MemoryRouter><TimelineView events={[first, second]} showVisibility onEventOpen={onEventOpen} communityFilter="godot" /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /Evento IGDA/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Evento Godot/ })).toBeInTheDocument()
  })

  it('moves to the first period that contains the selected community events', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00-05:00'))
    try {
      const otherCommunityEvent = timelineEvent({ id: 'other', title: 'Evento de otra comunidad', communityId: 'other', communityName: 'Otra comunidad' })
      const sandaEvent = timelineEvent({ id: 'sanda', title: 'Evento SANDA', communityId: 'sanda', communityName: 'SANDA', startsAt: '2026-09-25T09:00:00-05:00', endsAt: '2026-09-28T18:00:00-05:00' })
      const view = render(<MemoryRouter><TimelineView events={[otherCommunityEvent, sandaEvent]} showVisibility={false} onEventOpen={vi.fn()} communityFilter="all" /></MemoryRouter>)

      expect(screen.queryByRole('button', { name: /Evento SANDA/ })).not.toBeInTheDocument()
      const timeline = screen.getByRole('region', { name: /Línea de tiempo/ })
      view.rerender(<MemoryRouter><TimelineView events={[otherCommunityEvent, sandaEvent]} showVisibility={false} onEventOpen={vi.fn()} communityFilter="sanda" /></MemoryRouter>)
      expect(timeline).toBeInTheDocument()

      expect(screen.getByRole('heading', { name: 'Setiembre de 2026' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Evento SANDA/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ver semanas siguientes' })).toBeDisabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reserves the height of three community rows and grows for additional communities', () => {
    const first = timelineEvent({ id: 'first', communityId: 'igda', communityName: 'IGDA Perú' })
    const second = timelineEvent({ id: 'second', communityId: 'godot', communityName: 'Godot Lima' })
    const third = timelineEvent({ id: 'third', communityId: 'unity', communityName: 'Unity Perú' })
    const fourth = timelineEvent({ id: 'fourth', communityId: 'unreal', communityName: 'Unreal Perú' })
    const { container, rerender } = render(<MemoryRouter><TimelineView events={[first]} showVisibility={false} onEventOpen={vi.fn()} /></MemoryRouter>)

    expect(container.querySelector('.timeline-body')).toHaveStyle({ minHeight: '204px' })
    expect(container.querySelectorAll('.timeline-community-row')).toHaveLength(3)
    expect(container.querySelectorAll('.timeline-community-row--placeholder')).toHaveLength(2)
    expect(container.querySelectorAll('.timeline-community-row--placeholder .community-logo')).toHaveLength(0)
    rerender(<MemoryRouter><TimelineView events={[first, second, third, fourth]} showVisibility={false} onEventOpen={vi.fn()} /></MemoryRouter>)
    expect(container.querySelector('.timeline-body')).toHaveStyle({ minHeight: '272px' })
    expect(container.querySelectorAll('.timeline-community-row--placeholder')).toHaveLength(0)
  })

  it('does not let neighboring single-day labels share the same gap', () => {
    const range = timelineRangeForMonth(new Date(2026, 8, 1))
    const visibleDays = range.days.slice(21, 28)
    const sectionRange = { ...range, startKey: visibleDays[0], endKey: visibleDays[visibleDays.length - 1], days: visibleDays }
    const first = timelineEvent({ id: 'first-single-day', startsAt: '2026-09-23T09:00:00-05:00', endsAt: '2026-09-23T18:00:00-05:00' })
    const second = timelineEvent({ id: 'second-single-day', startsAt: '2026-09-26T09:00:00-05:00', endsAt: '2026-09-26T18:00:00-05:00' })
    const segments = buildTimelineSegments([first, second], sectionRange)
    const layouts = timelineSingleDayLabelLayouts(segments, visibleDays.length, 38)

    expect(layouts[0]).toMatchObject({ labelBefore: false, labelHidden: false, labelWidth: 68 })
    expect(layouts[1]).toMatchObject({ labelHidden: true, labelWidth: 0 })
  })

  it('uses the normal timeline density and paginates sections with arrows in the timeline header', () => {
    const first = timelineEvent({ id: 'first', title: 'Evento primera sección' })
    const later = timelineEvent({ id: 'later', title: 'Evento segunda sección', startsAt: '2026-09-25T09:00:00-05:00', endsAt: '2026-09-25T18:00:00-05:00' })
    render(<MemoryRouter><TimelineView events={[first, later]} showVisibility={false} onEventOpen={vi.fn()} /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /Evento primera sección/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Evento segunda sección/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Zoom/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver semanas anteriores' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ver semanas siguientes' }))
    expect(screen.getByRole('button', { name: /Evento segunda sección/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Evento primera sección/ })).not.toBeInTheDocument()
  })

  it('keeps manual month navigation after handling an event focus request', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T12:00:00-05:00'))
    try {
      render(<MemoryRouter><TimelineView events={[timelineEvent({ id: 'focused-event', title: 'Evento enfocado' })]} showVisibility={false} onEventOpen={vi.fn()} focusRequest={{ eventId: 'focused-event', nonce: 1 }} /></MemoryRouter>)
      vi.runOnlyPendingTimers()
      fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
      expect(screen.getByRole('heading', { name: 'Octubre de 2026' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('EventResults cards', () => {
  it('finds the immediate upcoming event after the focused event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00-05:00'))
    try {
      const first = timelineEvent({ id: 'first', startsAt: '2026-09-19T09:00:00-05:00', endsAt: '2026-09-19T18:00:00-05:00' })
      const second = timelineEvent({ id: 'second', startsAt: '2026-09-20T09:00:00-05:00', endsAt: '2026-09-20T18:00:00-05:00' })
      const filteredOut = timelineEvent({ id: 'filtered-out', communityId: 'other-community', startsAt: '2026-09-21T09:00:00-05:00', endsAt: '2026-09-21T18:00:00-05:00' })

      expect(findNextEventAfter([first, second, filteredOut], first.id)).toBe(second)
      expect(findNextEventAfter([first, second], second.id)).toBeNull()
      expect(findPreviousEventBefore([first, second, filteredOut], second.id)).toBe(first)
      expect(findPreviousEventBefore([first, second], first.id)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows both navigation arrows after focusing and follows the active community filter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00-05:00'))
    try {
      const first = timelineEvent({ id: 'first', title: 'Primer evento', startsAt: '2026-09-19T09:00:00-05:00', endsAt: '2026-09-19T18:00:00-05:00', communityId: 'community-1' })
      const second = timelineEvent({ id: 'second', title: 'Siguiente evento', startsAt: '2026-09-20T09:00:00-05:00', endsAt: '2026-09-20T18:00:00-05:00', communityId: 'community-1' })
      const filteredOut = timelineEvent({ id: 'filtered-out', title: 'Evento filtrado', startsAt: '2026-09-21T09:00:00-05:00', endsAt: '2026-09-21T18:00:00-05:00', communityId: 'other-community' })
      const { container } = render(<MemoryRouter><EventResults events={[first, second, filteredOut]} viewMode="cards" showVisibility={false} onEventOpen={vi.fn()} communityFilter="community-1" /></MemoryRouter>)

      expect(container.querySelector('.event-next-button')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Próximo evento' }))
      expect(container.querySelector('.event-next-button')).toBeInTheDocument()
      expect(container.querySelector('.event-focus-button')).toBeInTheDocument()
      expect(container.querySelector('.event-focus-button svg')).toBeInTheDocument()
      expect(container.querySelector('.event-focus-button span')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Próximo evento' })).toHaveAttribute('aria-pressed', 'true')
      expect(container.querySelector('.event-focus-button')).toHaveClass('active')
      expect(container.querySelector('.event-previous-button')).toBeDisabled()

      expect(screen.queryByRole('button', { name: /Evento filtrado/ })).not.toBeInTheDocument()

      fireEvent.click(container.querySelector<HTMLButtonElement>('.event-next-button') as HTMLButtonElement)
      vi.runOnlyPendingTimers()
      expect(document.querySelector('[data-event-focus-id="second"]')).toHaveFocus()
      expect(container.querySelector('.event-next-button')).toBeDisabled()
      expect(container.querySelector('.event-previous-button')).toBeEnabled()

      fireEvent.click(container.querySelector<HTMLButtonElement>('.event-previous-button') as HTMLButtonElement)
      vi.runOnlyPendingTimers()
      expect(document.querySelector('[data-event-focus-id="first"]')).toHaveFocus()
      expect(container.querySelector('.event-previous-button')).toBeDisabled()
      expect(container.querySelector('.event-next-button')).toBeEnabled()

      fireEvent.click(screen.getByRole('button', { name: 'Próximo evento' }))
      expect(container.querySelector('.event-next-button')).not.toBeInTheDocument()
      expect(container.querySelector('.event-previous-button')).not.toBeInTheDocument()
      expect(container.querySelector('.event-focus-button span')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Próximo evento' })).toHaveAttribute('aria-pressed', 'false')
      expect(container.querySelector('.event-focus-button')).not.toHaveClass('active')
      expect(container.querySelector('[data-event-focus-id="first"]')).not.toHaveClass('focused')
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['calendar', 'timeline'] as const)('keeps a persistent preview in the %s view until the event is clicked', (viewMode) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00-05:00'))
    try {
      const first = timelineEvent({ id: 'first', title: 'Primer evento', startsAt: '2026-09-19T09:00:00-05:00', endsAt: '2026-09-19T18:00:00-05:00' })
      const second = timelineEvent({ id: 'second', title: 'Siguiente evento', startsAt: '2026-09-20T09:00:00-05:00', endsAt: '2026-09-20T18:00:00-05:00' })
      const onEventOpen = vi.fn()
      const { container } = render(<MemoryRouter><EventResults events={[first, second]} viewMode={viewMode} showVisibility={false} onEventOpen={onEventOpen} /></MemoryRouter>)

      fireEvent.click(screen.getByRole('button', { name: 'Próximo evento' }))
      vi.runOnlyPendingTimers()
      const focusedEvent = container.querySelector(`[data-event-focus-id="${first.id}"]`)
      expect(focusedEvent).toHaveClass('focused')
      expect(focusedEvent?.querySelector('.calendar-event-hover-card')).toBeInTheDocument()

      fireEvent.click(focusedEvent as HTMLElement)
      expect(onEventOpen).toHaveBeenCalledWith(first)
      expect(container.querySelector(`[data-event-focus-id="${first.id}"]`)).not.toHaveClass('focused')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the active event when switching between views', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00-05:00'))
    try {
      const first = timelineEvent({ id: 'first', title: 'Primer evento', startsAt: '2026-09-19T09:00:00-05:00', endsAt: '2026-09-19T18:00:00-05:00' })
      const second = timelineEvent({ id: 'second', title: 'Siguiente evento', startsAt: '2026-09-20T09:00:00-05:00', endsAt: '2026-09-20T18:00:00-05:00' })
      const { container, rerender } = render(<MemoryRouter><EventResults events={[first, second]} viewMode="cards" showVisibility={false} onEventOpen={vi.fn()} toolbarCenter={<EventViewSwitcher value="cards" onChange={vi.fn()} />} /></MemoryRouter>)

      fireEvent.click(screen.getByRole('button', { name: 'Próximo evento' }))
      rerender(<MemoryRouter><EventResults events={[first, second]} viewMode="calendar" showVisibility={false} onEventOpen={vi.fn()} toolbarCenter={<EventViewSwitcher value="calendar" onChange={vi.fn()} />} /></MemoryRouter>)
      vi.runOnlyPendingTimers()

      expect(container.querySelector(`[data-event-focus-id="${first.id}"]`)).toHaveClass('focused')
      expect(container.querySelector('.calendar-event-hover-card')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows past events after a divider while keeping upcoming cards first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T12:00:00-05:00'))
    try {
      const past = timelineEvent({ id: 'past-card', title: 'Evento pasado', startsAt: '2026-08-19T09:00:00-05:00', endsAt: '2026-08-19T18:00:00-05:00' })
      const upcoming = timelineEvent({ id: 'upcoming-card', title: 'Evento próximo', startsAt: '2026-09-19T09:00:00-05:00', endsAt: '2026-09-19T18:00:00-05:00' })
      render(<MemoryRouter><EventResults events={[past, upcoming]} viewMode="cards" showVisibility={false} onEventOpen={vi.fn()} /></MemoryRouter>)

      expect(screen.getByRole('button', { name: /^Evento próximo$/ })).toBeInTheDocument()
      const pastEventsToggle = screen.getByRole('button', { name: 'Eventos que ya pasaron' })
      expect(pastEventsToggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('button', { name: /^Evento pasado$/ })).not.toBeInTheDocument()
      fireEvent.click(pastEventsToggle)
      expect(pastEventsToggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('button', { name: /^Evento pasado$/ })).toBeInTheDocument()
      expect(screen.getByRole('separator', { name: 'Mes Agosto de 2026' })).toBeInTheDocument()

      const eventListText = document.querySelector('.event-list')?.textContent ?? ''
      expect(eventListText.indexOf('Evento próximo')).toBeLessThan(eventListText.indexOf('Evento pasado'))
    } finally {
      vi.useRealTimers()
    }
  })
})
