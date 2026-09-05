import { describe, expect, it } from 'vitest'
import { eventIntervalsOverlap } from './eventConflicts'

const interval = ['2026-10-01T10:00:00-05:00', '2026-10-01T12:00:00-05:00'] as const

describe('event interval conflicts', () => {
  it('detects partial and complete intersections', () => {
    expect(eventIntervalsOverlap(interval[0], interval[1], '2026-10-01T11:00:00-05:00', '2026-10-01T13:00:00-05:00')).toBe(true)
    expect(eventIntervalsOverlap(interval[0], interval[1], '2026-10-01T09:00:00-05:00', '2026-10-01T13:00:00-05:00')).toBe(true)
    expect(eventIntervalsOverlap(interval[0], interval[1], '2026-10-01T09:00:00-05:00', '2026-10-01T10:30:00-05:00')).toBe(true)
  })

  it('does not treat touching half-open intervals as conflicts', () => {
    expect(eventIntervalsOverlap(interval[0], interval[1], interval[1], '2026-10-01T14:00:00-05:00')).toBe(false)
  })
})
