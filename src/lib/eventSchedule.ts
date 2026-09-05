export type EventDateMode = 'single' | 'range'

export type EventSchedule = {
  mode: EventDateMode
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  isAllDay: boolean
}

export const emptyEventSchedule: EventSchedule = {
  mode: 'single',
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '10:00',
  isAllDay: false,
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function addDaysToDateKey(value: string, days: number) {
  if (!isValidDateKey(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function parseLocalDateTime(value: string | null | undefined) {
  if (!value) return null
  const localMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value)
  if (!localMatch) return null
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  if (!hasTimezone) return { date: localMatch[1], time: localMatch[2] }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Map(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((part) => [part.type, part.value]))
  const localDate = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
  const localTime = `${parts.get('hour')}:${parts.get('minute')}`
  if (!isValidDateKey(localDate) || !/^\d{2}:\d{2}$/.test(localTime)) return null
  return { date: localDate, time: localTime }
}

export function eventScheduleToLocalDateTimes(schedule: EventSchedule) {
  const startDate = schedule.startDate
  const endDate = schedule.mode === 'single' ? startDate : schedule.endDate
  if (!startDate) return { startsAt: '', endsAt: '' }

  if (schedule.isAllDay) {
    const effectiveEndDate = addDaysToDateKey(endDate || startDate, 1)
    return {
      startsAt: `${startDate}T00:00`,
      endsAt: effectiveEndDate ? `${effectiveEndDate}T00:00` : '',
    }
  }

  return {
    startsAt: schedule.startTime ? `${startDate}T${schedule.startTime}` : '',
    endsAt: endDate && schedule.endTime ? `${endDate}T${schedule.endTime}` : '',
  }
}

export function eventScheduleFromLocalDateTimes(startsAt: string | null | undefined, endsAt: string | null | undefined, isAllDay = false): EventSchedule {
  const start = parseLocalDateTime(startsAt)
  const end = parseLocalDateTime(endsAt)
  const startDate = start?.date || ''
  const endDate = isAllDay ? addDaysToDateKey(end?.date || startDate, -1) || startDate : end?.date || startDate

  return {
    mode: endDate && endDate !== startDate ? 'range' : 'single',
    startDate,
    endDate,
    startTime: isAllDay ? emptyEventSchedule.startTime : start?.time || emptyEventSchedule.startTime,
    endTime: isAllDay ? emptyEventSchedule.endTime : end?.time || emptyEventSchedule.endTime,
    isAllDay,
  }
}
