import { describe, expect, it } from 'vitest'
import { validateEvent } from './eventValidation'
import { EVENT_DESCRIPTION_MAX_LENGTH } from './eventLimits'
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
  accessMode: 'location_access',
  locationPrecision: 'none',
  locationDepartment: '',
  locationProvince: '',
  venueName: '',
  address: '',
  mapUrl: '',
  placeId: '',
  formattedAddress: '',
  latitude: null,
  longitude: null,
  meetingUrl: '',
  meetingProvider: 'other',
  registrationUrl: '',
  visibility: 'public',
  status: 'draft',
}

describe('event validation', () => {
  it('allows a draft with only community, title and date', () => {
    const result = validateEvent({ ...baseEvent, startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' }, 'draft')

    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('rejects descriptions longer than the editor limit', () => {
    const result = validateEvent({
      ...baseEvent,
      description: 'x'.repeat(EVENT_DESCRIPTION_MAX_LENGTH + 1),
      startsAt: '2026-10-01T19:00',
      endsAt: '2026-10-01T21:00',
    }, 'draft')

    expect(result.valid).toBe(false)
    expect(result.errors.description).toContain(`${EVENT_DESCRIPTION_MAX_LENGTH}`)
  })

  it('requires a custom label when the event type is OTRO', () => {
    const result = validateEvent({ ...baseEvent, type: 'OTRO', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' }, 'draft')

    expect(result.valid).toBe(false)
    expect(result.errors.type).toContain('tipo de evento')
    expect(validateEvent({ ...baseEvent, type: 'Festival', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' }, 'draft').errors.type).toBeUndefined()
  })

  it('requires community, a meaningful title and dates for drafts', () => {
    const result = validateEvent({ ...baseEvent, communityId: '', title: 'a' }, 'draft')

    expect(result.valid).toBe(false)
    expect(result.errors.communityId).toBeTruthy()
    expect(result.errors.title).toBeTruthy()
    expect(result.errors.startsAt).toBeTruthy()
    expect(result.errors.endsAt).toBeTruthy()
  })

  it('allows platform admins to publish an independent event with an organizer', () => {
    const result = validateEvent({
      ...baseEvent,
      communityId: null,
      organizerName: 'Organización independiente',
      description: 'Una actividad abierta para la comunidad.',
      startsAt: '2026-10-01T19:00',
      endsAt: '2026-10-01T21:00',
    }, 'publish', { allowIndependent: true })

    expect(result.valid).toBe(true)
    expect(result.missing).not.toContain('communityId')
    expect(result.missing).not.toContain('organizerName')
  })

  it('allows network publication with only community, title and date', () => {
    const result = validateEvent({ ...baseEvent, visibility: 'network', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' }, 'publish')

    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('allows public publication without location or access links', () => {
    const result = validateEvent(baseEvent, 'publish')

    expect(result.valid).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining(['description', 'startsAt', 'endsAt']))
    expect(result.missing).not.toContain('location')
    expect(result.missing).not.toContain('meetingUrl')
  })

  it('allows registration-only publication without opening location or online fields', () => {
    const result = validateEvent({
      ...baseEvent,
      accessMode: 'registration_only',
      description: 'Una actividad para la comunidad.',
      startsAt: '2026-10-01T19:00',
      endsAt: '2026-10-01T21:00',
      locationType: 'venue',
      locationPrecision: 'exact',
      meetingUrl: 'not-a-url',
    }, 'publish')

    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('validates general location precision without requiring an exact address', () => {
    const shared = { ...baseEvent, description: 'Una actividad para la comunidad.', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00', locationPrecision: 'department' as const }

    expect(validateEvent(shared, 'publish').errors.location).toContain('departamento')
    expect(validateEvent({ ...shared, locationDepartment: 'Cusco' }, 'publish').valid).toBe(true)
    expect(validateEvent({ ...shared, locationPrecision: 'province', locationDepartment: 'Cusco' }, 'publish').errors.location).toContain('provincia')
    expect(validateEvent({ ...shared, locationPrecision: 'province', locationDepartment: 'Cusco', locationProvince: 'Cusco' }, 'publish').valid).toBe(true)
  })

  it('accepts complete online and hybrid events with valid links', () => {
    const shared = { ...baseEvent, description: 'Una actividad para la comunidad.', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00', meetingUrl: 'https://meet.google.com/abc-defg-hij' }

    expect(validateEvent({ ...shared, locationType: 'online' }, 'publish').valid).toBe(true)
    expect(validateEvent({ ...shared, locationType: 'hybrid', address: 'Av. Lima 123' }, 'publish').valid).toBe(true)
  })

  it('requires a join link for published online and hybrid events', () => {
    const result = validateEvent({ ...baseEvent, description: 'Una actividad para la comunidad.', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00', locationType: 'online', meetingUrl: '' }, 'publish')

    expect(result.errors.meetingUrl).toContain('enlace')
  })

  it('distinguishes invalid same-day hours from invalid date ranges', () => {
    const shared = { ...baseEvent, description: 'Una actividad para la comunidad.', locationType: 'online' as const, meetingUrl: 'https://meet.google.com/abc-defg-hij' }
    expect(validateEvent({ ...shared, startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T18:00' }, 'publish').errors.endsAt).toContain('hora de fin')
    expect(validateEvent({ ...shared, startsAt: '2026-10-03T19:00', endsAt: '2026-10-01T21:00' }, 'publish').errors.endsAt).toContain('fecha de fin')
  })

  it('rejects invalid access and map URLs for public publication', () => {
    const result = validateEvent({ ...baseEvent, description: 'Una actividad para la comunidad.', startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00', locationType: 'online', meetingUrl: 'meet.google.com/invalid', registrationUrl: 'forms.example.com/invalid', mapUrl: 'maps.google.com/invalid' }, 'publish')

    expect(result.errors.meetingUrl).toContain('http')
    expect(result.errors.registrationUrl).toContain('http')
    expect(result.errors.mapUrl).toContain('http')
  })
})
