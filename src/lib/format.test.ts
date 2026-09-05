import { describe, expect, it } from 'vitest'
import { eventSlug, formatDateParts, formatEventDateRange, formatTimeRange, meetingActionLabel, slugify } from './format'

describe('format helpers', () => {
  it('creates URL-safe slugs from Spanish names', () => {
    expect(slugify('  Taller: Diseño de niveles  ')).toBe('taller-diseno-de-niveles')
    expect(eventSlug('Taller: Diseño de niveles', 'IGDA Perú')).toBe('taller-diseno-de-niveles-igda-peru')
  })

  it('formats event dates in Lima', () => {
    expect(formatDateParts('2026-09-19T19:00:00-05:00')).toEqual({ month: 'SET', date: '19', weekday: 'SÁB' })
    expect(formatTimeRange('2026-09-19T19:00:00-05:00', '2026-09-19T21:00:00-05:00')).toContain('7:00')
    expect(formatTimeRange('2026-09-19T00:00:00-05:00', '2026-09-20T00:00:00-05:00', true)).toBe('Todo el día')
    expect(formatEventDateRange('2026-09-19T00:00:00-05:00', '2026-09-23T00:00:00-05:00', true)).toContain('22')
  })

  it('labels Discord meeting links correctly', () => {
    expect(meetingActionLabel('discord')).toBe('Unirme por Discord')
  })
})
