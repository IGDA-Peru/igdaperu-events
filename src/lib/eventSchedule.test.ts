import { describe, expect, it } from 'vitest'
import { emptyEventSchedule, eventScheduleFromLocalDateTimes, eventScheduleToLocalDateTimes } from './eventSchedule'

describe('event schedule helpers', () => {
  it('serializes a one-day timed event', () => {
    expect(eventScheduleToLocalDateTimes({ ...emptyEventSchedule, startDate: '2026-10-01', endDate: '2026-10-01', startTime: '19:00', endTime: '21:00' })).toEqual({ startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T21:00' })
  })

  it('serializes a multi-day timed range', () => {
    expect(eventScheduleToLocalDateTimes({ ...emptyEventSchedule, mode: 'range', startDate: '2026-10-01', endDate: '2026-10-03', startTime: '09:00', endTime: '18:00' })).toEqual({ startsAt: '2026-10-01T09:00', endsAt: '2026-10-03T18:00' })
  })

  it('uses an exclusive next-day end for an all-day event', () => {
    expect(eventScheduleToLocalDateTimes({ ...emptyEventSchedule, isAllDay: true, startDate: '2026-10-01', endDate: '2026-10-01' })).toEqual({ startsAt: '2026-10-01T00:00', endsAt: '2026-10-02T00:00' })
    expect(eventScheduleToLocalDateTimes({ ...emptyEventSchedule, mode: 'range', isAllDay: true, startDate: '2026-10-01', endDate: '2026-10-03' })).toEqual({ startsAt: '2026-10-01T00:00', endsAt: '2026-10-04T00:00' })
  })

  it('reconstructs the inclusive end date when editing an all-day range', () => {
    expect(eventScheduleFromLocalDateTimes('2026-10-01T00:00', '2026-10-04T00:00', true)).toEqual({ ...emptyEventSchedule, mode: 'range', startDate: '2026-10-01', endDate: '2026-10-03', isAllDay: true })
  })

  it('converts stored UTC timestamps back to Lima date and time', () => {
    expect(eventScheduleFromLocalDateTimes('2026-10-02T04:00:00.000Z', '2026-10-02T06:00:00.000Z')).toEqual({ ...emptyEventSchedule, mode: 'range', startDate: '2026-10-01', endDate: '2026-10-02', startTime: '23:00', endTime: '01:00' })
  })
})
