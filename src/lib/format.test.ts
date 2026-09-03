import { describe, expect, it } from 'vitest'
import { formatDateParts, formatTimeRange, slugify } from './format'

describe('format helpers', () => {
  it('creates URL-safe slugs from Spanish names', () => {
    expect(slugify('  Taller: Diseño de niveles  ')).toBe('taller-diseno-de-niveles')
  })

  it('formats event dates in Lima', () => {
    expect(formatDateParts('2026-09-19T19:00:00-05:00')).toEqual({ month: 'SET', date: '19', weekday: 'SÁB' })
    expect(formatTimeRange('2026-09-19T19:00:00-05:00', '2026-09-19T21:00:00-05:00')).toContain('7:00')
  })
})
