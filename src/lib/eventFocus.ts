import { isEventPast } from './format'
import type { EventItem } from '../types'

export function findNextEvent(events: EventItem[]) {
  const now = Date.now()
  const scheduled = events.filter((event) => event.startsAt && !isEventPast(event)).sort((first, second) => new Date(first.startsAt as string).getTime() - new Date(second.startsAt as string).getTime())
  return scheduled.find((event) => new Date(event.startsAt as string).getTime() >= now) || scheduled[0] || null
}
