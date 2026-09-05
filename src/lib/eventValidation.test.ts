import { describe, expect, it } from 'vitest'
import { validateEvent } from './eventValidation'
import type { EventInput } from '../types'

const baseEvent: EventInput = {
  communityId: 'community-1',
  title: 'Meetup de prueba',
  slug: 'meetup-de-prueba',
  description: '',
  type: 'CHARLA',
  startsAt: '',
  endsAt: '',
  isAllDay: false,
  locationType: 'venue',
  venueName: '',
  address: '',
  mapUrl: '',
  placeId: '',
  formattedAddress: '',
  latitude: null,
  longitude: null,
  meetingUrl: '',
  meetingProvider: 'other',
  visibility: 'public',
  status: 'draft',
}

describe('event validation', () => {
  it('allows a draft with only community, title and date', () => {
    const result = validateEvent({ ...baseEvent, startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' }, 'draft')

    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('requires community, a meaningful title and dates for drafts', () => {
    const result = validateEvent({ ...baseEvent, communityId: '', title: 'a' }, 'draft')

    expect(result.valid).toBe(false)
    expect(result.errors.communityId).toBeTruthy()
    expect(result.errors.title).toBeTruthy()
    expect(result.errors.startsAt).toBeTruthy()
    expect(result.errors.endsAt).toBeTruthy()
  })

  it('allows network publication with only community, title and date', () => {
    const result = validateEvent({ ...baseEvent, visibility: 'network', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' }, 'publish')

    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('lists publish requirements for a physical event', () => {
    const result = validateEvent(baseEvent, 'publish')

    expect(result.valid).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining(['description', 'startsAt', 'endsAt', 'location']))
  })

  it('accepts complete online and hybrid events with valid links', () => {
    const shared = { ...baseEvent, description: 'Una actividad para la comunidad.', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00', meetingUrl: 'https://meet.google.com/abc-defg-hij' }

    expect(validateEvent({ ...shared, locationType: 'online' }, 'publish').valid).toBe(true)
    expect(validateEvent({ ...shared, locationType: 'hybrid', address: 'Av. Lima 123' }, 'publish').valid).toBe(true)
  })

  it('distinguishes invalid same-day hours from invalid date ranges', () => {
    const shared = { ...baseEvent, description: 'Una actividad para la comunidad.', locationType: 'online' as const, meetingUrl: 'https://meet.google.com/abc-defg-hij' }
    expect(validateEvent({ ...shared, startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T18:00' }, 'publish').errors.endsAt).toContain('hora de fin')
    expect(validateEvent({ ...shared, startsAt: '2026-10-03T19:00', endsAt: '2026-10-01T21:00' }, 'publish').errors.endsAt).toContain('fecha de fin')
  })

  it('rejects invalid meeting and map URLs for public publication', () => {
    const result = validateEvent({ ...baseEvent, description: 'Una actividad para la comunidad.', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00', locationType: 'online', meetingUrl: 'meet.google.com/invalid', mapUrl: 'maps.google.com/invalid' }, 'publish')

    expect(result.errors.meetingUrl).toContain('http')
    expect(result.errors.mapUrl).toContain('http')
  })
})
