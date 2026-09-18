import { isEventPast } from './format'
import type { EventItem } from '../types'

function scheduledUpcomingEvents(events: EventItem[]) {
  return events
    .filter((event) => event.startsAt && !isEventPast(event))
    .sort((first, second) => new Date(first.startsAt as string).getTime() - new Date(second.startsAt as string).getTime())
}

export function findNextEvent(events: EventItem[]) {
  const now = Date.now()
  const scheduled = scheduledUpcomingEvents(events)
  return scheduled.find((event) => new Date(event.startsAt as string).getTime() >= now) || scheduled[0] || null
}

export function findNextEventAfter(events: EventItem[], currentEventId: string) {
  const scheduled = scheduledUpcomingEvents(events)
  const currentIndex = scheduled.findIndex((event) => event.id === currentEventId)
  return currentIndex >= 0 ? scheduled[currentIndex + 1] || null : null
}

export function findPreviousEventBefore(events: EventItem[], currentEventId: string) {
  const scheduled = scheduledUpcomingEvents(events)
  const currentIndex = scheduled.findIndex((event) => event.id === currentEventId)
  return currentIndex > 0 ? scheduled[currentIndex - 1] : null
}
