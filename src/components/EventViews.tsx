import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, LocateFixed, LockKeyhole } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { getEventCoverUrl } from '../lib/data'
import { formatEventDateRange, formatEventLocation, formatTimeRange, isEventPast } from '../lib/format'
import { findNextEvent, findNextEventAfter, findPreviousEventBefore } from '../lib/eventFocus'
import type { EventItem } from '../types'
import { communityTint, normalizeCommunityColor } from '../lib/communityBranding'
import { matchesCommunityFilter } from '../lib/eventFilters'
import { EmptyEvents, EventCard } from './EventCard'
import { CommunityLogo } from './CommunityLogo'
import { eventViewModes, type EventViewMode } from './eventViewModes'
import { localeTags, useLocale } from '../i18n'

export function EventViewSwitcher({ value, onChange }: { value: EventViewMode; onChange: (mode: EventViewMode) => void }) {
  const { t } = useLocale()
  const labels: Record<EventViewMode, string> = { cards: t('agenda.cards'), calendar: t('agenda.calendar'), timeline: t('agenda.timeline') }
  return (
    <div className="view-switcher" role="group" aria-label={`${t('agenda.view')}: ${t('agenda.events').toLowerCase()}`}>
      {eventViewModes.map(({ value: mode, Icon }) => (
        <button className={`view-switch ${value === mode ? 'selected' : ''}`} type="button" aria-pressed={value === mode} key={mode} onClick={() => onChange(mode)}>
          <Icon size={16} aria-hidden="true" />
          <span>{labels[mode]}</span>
        </button>
      ))}
    </div>
  )
}

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const limaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })

function limaDateKey(value: string | Date) {
  return limaDateFormatter.format(typeof value === 'string' ? new Date(value) : value)
}

function monthDateForEvent(event: EventItem) {
  if (!event.startsAt) return new Date()
  const [year, month] = limaDateKey(event.startsAt).split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function eventMonthLabel(event: EventItem, locale = 'es-PE') {
  if (!event.startsAt) return locale.startsWith('en') ? 'Date to be confirmed' : locale.startsWith('qu') ? 'P’unchawta qhawarisunchik' : 'Fecha por confirmar'
  const parsed = new Date(event.startsAt)
  if (Number.isNaN(parsed.getTime())) return locale.startsWith('en') ? 'Date to be confirmed' : locale.startsWith('qu') ? 'P’unchawta qhawarisunchik' : 'Fecha por confirmar'
  return capitalize(new Intl.DateTimeFormat(locale, { timeZone: 'America/Lima', month: 'long', year: 'numeric' }).format(parsed))
}

export type EventFocusRequest = { eventId: string; nonce: number }

function focusEventElement(eventId: string) {
  const target = [...document.querySelectorAll<HTMLElement>('[data-event-focus-id]')].find((element) => element.dataset.eventFocusId === eventId)
  if (!target) return
  target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' })
  target.focus({ preventScroll: true })
}

function eventEndDateKey(event: EventItem, startKey: string) {
  if (!event.endsAt) return startKey
  const end = new Date(event.endsAt)
  if (Number.isNaN(end.getTime())) return startKey
  // An event that ends exactly at midnight belongs to the previous calendar day.
  end.setMilliseconds(end.getMilliseconds() - 1)
  return limaDateKey(end)
}

function dateOrdinal(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

type CalendarEventSegment = {
  event: EventItem
  startColumn: number
  endColumn: number
  lane: number
  isSingleDay: boolean
  continuesBefore: boolean
  continuesAfter: boolean
}

function calendarEventSegments(week: Array<{ key: string }>, events: EventItem[]): CalendarEventSegment[] {
  const weekStart = week[0].key
  const weekEnd = week[week.length - 1].key
  const segments = events.flatMap((event) => {
    if (!event.startsAt) return []
    const startKey = limaDateKey(event.startsAt)
    const endKey = eventEndDateKey(event, startKey)
    if (endKey < weekStart || startKey > weekEnd) return []
    const segmentStart = startKey < weekStart ? weekStart : startKey
    const segmentEnd = endKey > weekEnd ? weekEnd : endKey
    return [{
      event,
      startColumn: dateOrdinal(segmentStart) - dateOrdinal(weekStart),
      endColumn: dateOrdinal(segmentEnd) - dateOrdinal(weekStart),
      lane: 0,
      isSingleDay: startKey === endKey,
      continuesBefore: startKey < weekStart,
      continuesAfter: endKey > weekEnd,
    }]
  }).sort((first, second) => first.startColumn - second.startColumn || second.endColumn - first.endColumn || first.event.title.localeCompare(second.event.title))

  const laneEnds: number[] = []
  return segments.map((segment) => {
    const availableLane = laneEnds.findIndex((lastColumn) => lastColumn < segment.startColumn)
    const lane = availableLane === -1 ? laneEnds.length : availableLane
    laneEnds[lane] = segment.endColumn
    return { ...segment, lane }
  })
}

function calendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const firstCell = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell)
    date.setDate(firstCell.getDate() + index)
    return { date, key: calendarDateKey(date), inMonth: date.getMonth() === month }
  })
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function CalendarEventHoverPreview({ event, coverUrl }: { event: EventItem; coverUrl: string | null }) {
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const eventTypeLabel = t(`eventType.${event.type}`)
  return (
    <span className="calendar-event-hover-card" aria-hidden="true">
      <span className={`calendar-event-hover-media ${coverUrl ? '' : 'fallback'}`}>
        {coverUrl ? <img src={coverUrl} alt="" /> : <CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="medium" decorative />}
      </span>
      <span className="calendar-event-hover-copy">
        <span className="calendar-event-type">{eventTypeLabel.startsWith('eventType.') ? event.type : eventTypeLabel}</span>
        <strong>{event.title}</strong>
        <small>{formatEventDateRange(event.startsAt, event.endsAt, event.isAllDay, dateLocale)}</small>
        <small>{formatEventLocation(event, dateLocale)}</small>
      </span>
    </span>
  )
}

type HoverSide = 'left' | 'right' | 'inside'
type HoverPlacement = { side: HoverSide; width: number; offsetY: number; offsetX: number }

function calendarHoverPlacement(element: HTMLElement, containerSelector: string): HoverPlacement {
  const bounds = element.getBoundingClientRect()
  const container = element.closest<HTMLElement>(containerSelector)
  const containerBounds = container?.getBoundingClientRect()
  const gap = 10
  const edgePadding = 8
  const containerLeft = containerBounds?.left ?? 0
  const containerRight = containerBounds?.right ?? window.innerWidth
  const containerTop = containerBounds?.top ?? 0
  const containerBottom = containerBounds?.bottom ?? window.innerHeight
  const rightSpace = Math.max(0, containerRight - edgePadding - bounds.right - gap)
  const leftSpace = Math.max(0, bounds.left - (containerLeft + edgePadding) - gap)
  const idealWidth = Math.min(310, Math.max(180, window.innerWidth - 48))
  const fitsRight = rightSpace >= idealWidth
  const fitsLeft = leftSpace >= idealWidth
  const side: HoverSide = fitsRight || (!fitsLeft && rightSpace >= leftSpace) ? 'right' : 'left'
  const sideSpace = side === 'right' ? rightSpace : leftSpace
  const boardWidth = Math.max(0, containerRight - containerLeft - edgePadding * 2)
  const inside = sideSpace < idealWidth
  const resolvedSide: HoverSide = inside ? 'inside' : side
  const width = Math.max(0, Math.min(idealWidth, inside ? boardWidth : sideSpace))
  const card = element.querySelector<HTMLElement>('.calendar-event-hover-card')
  const cardHeight = card?.getBoundingClientRect().height || 120
  const desiredTop = bounds.top + bounds.height / 2 - cardHeight / 2
  const minTop = containerTop + edgePadding
  const maxTop = Math.max(minTop, containerBottom - edgePadding - cardHeight)
  const clampedTop = Math.min(maxTop, Math.max(minTop, desiredTop))
  const offsetY = clampedTop - desiredTop
  const desiredLeft = bounds.left + bounds.width / 2 - width / 2
  const minLeft = containerLeft + edgePadding
  const maxLeft = Math.max(minLeft, containerRight - edgePadding - width)
  const offsetX = resolvedSide === 'inside' ? Math.min(maxLeft, Math.max(minLeft, desiredLeft)) - bounds.left : 0
  return { side: resolvedSide, width, offsetY, offsetX }
}

function useContainedHoverPlacement(containerSelector: string) {
  const [hoverPlacement, setHoverPlacement] = useState<HoverPlacement>({ side: 'right', width: 310, offsetY: 0, offsetX: 0 })
  const barRef = useRef<HTMLButtonElement>(null)
  const updateHoverPlacement = useCallback((element: HTMLButtonElement) => setHoverPlacement(calendarHoverPlacement(element, containerSelector)), [containerSelector])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { if (barRef.current) updateHoverPlacement(barRef.current) })
    return () => window.cancelAnimationFrame(frame)
  }, [updateHoverPlacement])

  return { barRef, hoverPlacement, updateHoverPlacement }
}

function CalendarEventBar({ segment, coverUrl, onEventOpen, focused, onFocusClear }: { segment: CalendarEventSegment; coverUrl: string | null; onEventOpen?: (event: EventItem) => void; focused?: boolean; onFocusClear?: () => void }) {
  const { locale } = useLocale()
  const dateLocale = localeTags[locale]
  const { barRef, hoverPlacement, updateHoverPlacement } = useContainedHoverPlacement('.calendar-view')
  const { event } = segment

  return <button ref={barRef} className={`calendar-event-bar ${segment.isSingleDay ? 'single-day' : 'multi-day'} ${event.visibility === 'network' ? 'private' : 'public'} ${focused ? 'focused' : ''} ${isEventPast(event) ? 'past' : ''} hover-${hoverPlacement.side} ${segment.continuesBefore ? 'continues-before' : ''} ${segment.continuesAfter ? 'continues-after' : ''}`} data-event-focus-id={event.id} type="button" style={{ gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`, gridRow: segment.lane + 1, '--community-color': event.communityColor || undefined, '--calendar-hover-width': `${hoverPlacement.width}px`, '--calendar-hover-offset-y': `${hoverPlacement.offsetY}px`, '--calendar-hover-offset-x': `${hoverPlacement.offsetX}px` } as CSSProperties} aria-label={`${event.title}, ${formatEventDateRange(event.startsAt, event.endsAt, event.isAllDay, dateLocale)} · ${formatTimeRange(event.startsAt, event.endsAt, event.isAllDay, dateLocale)}`} onPointerEnter={(pointerEvent) => updateHoverPlacement(pointerEvent.currentTarget)} onFocus={(focusEvent) => updateHoverPlacement(focusEvent.currentTarget)} onClick={() => { onFocusClear?.(); onEventOpen?.(event) }}>
    {!segment.continuesBefore && <CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="small" decorative />}
    {!segment.continuesBefore && <span className="calendar-event-dot" aria-hidden="true" />}
    <span className="calendar-event-title">{event.title}</span>
    <CalendarEventHoverPreview event={event} coverUrl={coverUrl} />
  </button>
}

export function CalendarView({ events, onEventOpen, focusRequest, focusedEventId, onFocusClear, communityFilter = 'all' }: { events: EventItem[]; onEventOpen?: (event: EventItem) => void; focusRequest?: EventFocusRequest | null; focusedEventId?: string | null; onFocusClear?: () => void; communityFilter?: string }) {
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const scheduledEvents = useMemo(() => events.filter((event) => event.startsAt), [events])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const monthLabel = capitalize(new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' }).format(visibleMonth))
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, index + 1, 12))
    return new Intl.DateTimeFormat(dateLocale, { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', '')
  }), [dateLocale])
  const days = useMemo(() => calendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()), [visibleMonth])
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7)), [days])
  const filteredEvents = useMemo(() => scheduledEvents.filter((event) => matchesCommunityFilter(event, communityFilter)), [communityFilter, scheduledEvents])
  const weekSegments = useMemo(() => weeks.map((week) => calendarEventSegments(week, filteredEvents)), [weeks, filteredEvents])
  const isCurrentMonth = visibleMonth.getFullYear() === new Date().getFullYear() && visibleMonth.getMonth() === new Date().getMonth()
  const goToCurrentMonth = () => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const changeMonth = (delta: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))

  useEffect(() => {
    const requestedEventId = focusRequest?.eventId
    if (!requestedEventId) return
    const target = scheduledEvents.find((event) => event.id === requestedEventId)
    if (!target?.startsAt) return
    const targetMonth = monthDateForEvent(target)
    setVisibleMonth((current) => current.getFullYear() === targetMonth.getFullYear() && current.getMonth() === targetMonth.getMonth() ? current : targetMonth)
  }, [focusRequest, scheduledEvents])

  useEffect(() => {
    const focusEventId = focusRequest?.eventId
    if (!focusEventId) return
    const target = scheduledEvents.find((event) => event.id === focusEventId)
    if (!target?.startsAt) return
    const targetMonth = monthDateForEvent(target)
    if (targetMonth.getFullYear() !== visibleMonth.getFullYear() || targetMonth.getMonth() !== visibleMonth.getMonth()) return
    const frame = window.requestAnimationFrame(() => focusEventElement(focusEventId))
    return () => window.cancelAnimationFrame(frame)
  }, [focusRequest, scheduledEvents, visibleMonth, weekSegments])

  return (
    <section className="calendar-view" aria-label={`Calendario de ${monthLabel}`}>
      <div className="calendar-header">
        <div className="timeline-toolbar-main">
          <div className="timeline-month-heading">
            <h3 className="timeline-month-title">{monthLabel}</h3>
          </div>
          <div className="timeline-period-controls">
            <button className="timeline-control-button" type="button" aria-label={t('agenda.previousMonth')} onClick={() => changeMonth(-1)}><ChevronLeft size={17} /> <span>{t('agenda.previous')}</span></button>
            <button className={`timeline-control-button ${isCurrentMonth ? 'selected' : ''}`} type="button" onClick={goToCurrentMonth}><CalendarDays size={16} /> {t('agenda.today')}</button>
            <button className="timeline-control-button" type="button" aria-label={t('agenda.nextMonth')} onClick={() => changeMonth(1)}><span>{t('agenda.next')}</span> <ChevronRight size={17} /></button>
          </div>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {weeks.map((week, weekIndex) => {
            const segments = weekSegments[weekIndex]
            const laneCount = segments.length ? Math.max(...segments.map((segment) => segment.lane)) + 1 : 0
            const weekStyle = { minHeight: `${116 + Math.max(1, laneCount) * 27}px` } as CSSProperties
            return <div className="calendar-week" style={weekStyle} key={week[0].key}>
              <div className="calendar-week-days">
                {week.map(({ date, key, inMonth }) => {
                  const isToday = key === limaDateKey(new Date())
                  return <div className={`calendar-cell ${inMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}`} key={key}><span className="calendar-day-number">{date.getDate()}</span></div>
                })}
              </div>
              <div className="calendar-week-events" aria-label={t('agenda.calendarWeek', { date: week[0].key })}>
                {segments.map((segment) => {
                  const event = segment.event
                  const coverUrl = getEventCoverUrl(event.coverPath)
                  return <CalendarEventBar key={`${event.id}-${week[0].key}`} segment={segment} coverUrl={coverUrl} onEventOpen={onEventOpen} focused={focusedEventId === event.id} onFocusClear={onFocusClear} />
                })}
              </div>
            </div>
          })}
        </div>
      </div>
    </section>
  )
}

const timelineWeeksPerSection = 3
const timelineNormalDayWidth = 38
const timelineLabelWidth = 190
const timelineDefaultCommunityRows = 3
const timelineCommunityRowHeight = 68
const timelineLaneHeight = 38
const timelineTrackPadding = 20
const timelineSingleDayLabelMaxWidth = 160
const timelineSingleDayLabelMinWidth = 64
const timelinePalette = [
  { color: '#d82028', tint: 'rgb(216 32 40 / 14%)' },
  { color: '#2c73b7', tint: 'rgb(44 115 183 / 14%)' },
  { color: '#8250ad', tint: 'rgb(130 80 173 / 14%)' },
  { color: '#659b3c', tint: 'rgb(101 155 60 / 14%)' },
  { color: '#e26d1b', tint: 'rgb(226 109 27 / 14%)' },
  { color: '#b88313', tint: 'rgb(184 131 19 / 16%)' },
] as const

type TimelineRange = { monthStartKey: string; monthEndKey: string; startKey: string; endKey: string; days: string[] }

export type TimelineSegment = {
  event: EventItem
  lane: number
  startIndex: number
  endIndex: number
  continuesBefore: boolean
  continuesAfter: boolean
  isSingleDay: boolean
}

export type TimelineSingleDayLabelLayout = { labelBefore: boolean; labelHidden: boolean; labelWidth: number }

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00-05:00`)
}

function ordinalFromDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function dateKeyFromOrdinal(ordinal: number) {
  return new Date(ordinal * 86400000).toISOString().slice(0, 10)
}

function timelineMonthDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function timelineSectionForEvent(event: EventItem, month: Date, weeksPerSection: number) {
  if (!event.startsAt) return 0
  const range = timelineRangeForMonth(month)
  const dayIndex = range.days.indexOf(limaDateKey(event.startsAt))
  if (dayIndex < 0) return 0
  const sectionCount = Math.max(1, Math.ceil((range.days.length / 7) / weeksPerSection))
  return Math.min(sectionCount - 1, Math.floor(Math.floor(dayIndex / 7) / weeksPerSection))
}

export function timelineRangeForMonth(month: Date): TimelineRange {
  const monthStart = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1))
  const monthEnd = new Date(Date.UTC(month.getFullYear(), month.getMonth() + 1, 0))
  const monthStartKey = dateKeyFromDate(monthStart)
  const monthEndKey = dateKeyFromDate(monthEnd)
  const mondayOffset = (monthStart.getUTCDay() + 6) % 7
  const sundayOffset = (7 - monthEnd.getUTCDay()) % 7
  const startOrdinal = ordinalFromDateKey(monthStartKey) - mondayOffset
  const endOrdinal = ordinalFromDateKey(monthEndKey) + sundayOffset
  return {
    monthStartKey,
    monthEndKey,
    startKey: dateKeyFromOrdinal(startOrdinal),
    endKey: dateKeyFromOrdinal(endOrdinal),
    days: Array.from({ length: endOrdinal - startOrdinal + 1 }, (_, index) => dateKeyFromOrdinal(startOrdinal + index)),
  }
}

function eventRangeForTimeline(event: EventItem) {
  if (!event.startsAt) return null
  const startKey = limaDateKey(event.startsAt)
  const endKey = eventEndDateKey(event, startKey)
  return { startKey, endKey, startOrdinal: ordinalFromDateKey(startKey), endOrdinal: ordinalFromDateKey(endKey) }
}

export function buildTimelineSegments(events: EventItem[], range: TimelineRange): TimelineSegment[] {
  const rangeStartOrdinal = ordinalFromDateKey(range.startKey)
  const rangeEndOrdinal = ordinalFromDateKey(range.endKey)
  const segments = events.flatMap((event) => {
    const eventRange = eventRangeForTimeline(event)
    if (!eventRange || eventRange.endOrdinal < rangeStartOrdinal || eventRange.startOrdinal > rangeEndOrdinal) return []
    const startIndex = Math.max(eventRange.startOrdinal, rangeStartOrdinal) - rangeStartOrdinal
    const actualEndIndex = Math.min(eventRange.endOrdinal, rangeEndOrdinal) - rangeStartOrdinal
    const isSingleDay = eventRange.startOrdinal === eventRange.endOrdinal
    // A one-day event remains a single calendar cell so it can render as a marker.
    const endIndex = Math.min(range.days.length - 1, Math.max(actualEndIndex, startIndex))
    return [{
      event,
      lane: 0,
      startIndex,
      endIndex,
      continuesBefore: eventRange.startOrdinal < rangeStartOrdinal,
      continuesAfter: eventRange.endOrdinal > rangeEndOrdinal,
      isSingleDay,
    }]
  }).sort((first, second) => first.startIndex - second.startIndex || second.endIndex - first.endIndex || first.event.title.localeCompare(second.event.title))

  const laneEnds: number[] = []
  return segments.map((segment) => {
    const availableLane = laneEnds.findIndex((lastEnd) => lastEnd < segment.startIndex)
    const lane = availableLane === -1 ? laneEnds.length : availableLane
    laneEnds[lane] = segment.endIndex
    return { ...segment, lane }
  })
}

function formatTimelineMonth(month: Date, locale = 'es-PE') {
  const label = new Intl.DateTimeFormat(locale, { timeZone: 'America/Lima', month: 'long', year: 'numeric' }).format(month).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatTimelineWeek(startKey: string, endKey: string, locale = 'es-PE') {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: 'America/Lima', day: 'numeric', month: 'short' })
  return `${formatter.format(dateFromKey(startKey)).replace('.', '')} – ${formatter.format(dateFromKey(endKey)).replace('.', '')}`
}

function formatTimelineDay(key: string, locale = 'es-PE') {
  const parts = new Intl.DateTimeFormat(locale, { timeZone: 'America/Lima', weekday: 'short', day: 'numeric' }).formatToParts(dateFromKey(key))
  const weekday = parts.find((part) => part.type === 'weekday')?.value.replace('.', '') || ''
  const day = parts.find((part) => part.type === 'day')?.value || ''
  return { weekday: weekday.slice(0, 3), day }
}

type TimelineColor = { color: string; tint: string }
type TimelineCommunity = { id: string; name: string; logoPath?: string | null; brandColor?: string | null; color: TimelineColor }

function stableCommunities(events: EventItem[]): TimelineCommunity[] {
  const communityMap = new Map<string, { id: string; name: string; logoPath?: string | null; brandColor?: string | null }>()
  events.forEach((event) => {
    const communityId = event.communityId || '__independent__'
    if (!communityMap.has(communityId)) communityMap.set(communityId, { id: communityId, name: event.communityName, logoPath: event.communityLogoPath, brandColor: event.communityColor })
  })
  return [...communityMap.values()].sort((first, second) => first.name.localeCompare(second.name, 'es')).map((community, index) => ({ ...community, color: community.brandColor ? { color: normalizeCommunityColor(community.brandColor), tint: communityTint(community.brandColor) } : timelinePalette[index % timelinePalette.length] }))
}

function timelineCssVariables(dayWidth: number, dayCount: number, labelWidth: number): CSSProperties {
  return {
    '--timeline-day-width': `${dayWidth}px`,
    '--timeline-day-count': String(dayCount),
    '--timeline-axis-width': `${dayWidth * dayCount}px`,
    '--timeline-label-width': `${labelWidth}px`,
  } as CSSProperties
}

function timelineStyle(color: TimelineColor): CSSProperties {
  return { '--timeline-color': color.color, '--timeline-tint': color.tint } as CSSProperties
}

export function timelineSingleDayLabelLayout(segments: TimelineSegment[], segment: TimelineSegment, visibleDayCount: number, dayWidth: number): TimelineSingleDayLabelLayout {
  if (!segment.isSingleDay) return { labelBefore: false, labelHidden: false, labelWidth: 0 }
  const segmentIndex = segments.indexOf(segment)
  const previousSegment = segmentIndex > 0 ? segments[segmentIndex - 1] : null
  const nextSegment = segmentIndex >= 0 && segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null
  const availableBeforeDays = Math.max(0, segment.startIndex - (previousSegment ? previousSegment.endIndex + 1 : 0))
  const availableAfterDays = Math.max(0, (nextSegment ? nextSegment.startIndex : visibleDayCount) - segment.endIndex - 1)
  const widthForGap = (days: number) => Math.max(0, Math.min(timelineSingleDayLabelMaxWidth, days * dayWidth - 8))
  const beforeWidth = widthForGap(availableBeforeDays)
  const afterWidth = widthForGap(availableAfterDays)
  const labelBefore = beforeWidth > afterWidth && beforeWidth >= timelineSingleDayLabelMinWidth
  const labelWidth = labelBefore ? beforeWidth : afterWidth
  return { labelBefore, labelHidden: labelWidth < timelineSingleDayLabelMinWidth, labelWidth }
}

export function timelineSingleDayLabelLayouts(segments: TimelineSegment[], visibleDayCount: number, dayWidth: number) {
  const layouts = segments.map((segment) => timelineSingleDayLabelLayout(segments, segment, visibleDayCount, dayWidth))
  return layouts.map((layout, index) => {
    if (!layout.labelBefore || layout.labelHidden || index === 0) return layout
    const previousSegment = segments[index - 1]
    const previousLayout = layouts[index - 1]
    const sharesGapWithPreviousLabel = previousSegment.isSingleDay && !previousLayout.labelBefore && !previousLayout.labelHidden && previousSegment.endIndex < segments[index].startIndex
    return sharesGapWithPreviousLabel ? { ...layout, labelHidden: true, labelWidth: 0 } : layout
  })
}

function TimelineDayGrid({ visibleDays, range }: { visibleDays: string[]; range: TimelineRange }) {
  return <div className="timeline-day-grid" aria-hidden="true">{visibleDays.map((key) => <span className={`${key < range.monthStartKey || key > range.monthEndKey ? 'outside-month' : ''} ${new Date(`${key}T12:00:00-05:00`).getDay() === 0 || new Date(`${key}T12:00:00-05:00`).getDay() === 6 ? 'weekend' : ''}`} key={key} />)}</div>
}

function TimelinePlaceholderRow({ visibleDays, range }: { visibleDays: string[]; range: TimelineRange }) {
  return <div className="timeline-community-row timeline-community-row--placeholder" aria-hidden="true">
    <div className="timeline-community-label" />
    <div className="timeline-track" style={{ minHeight: `${timelineCommunityRowHeight}px` }}>
      <TimelineDayGrid visibleDays={visibleDays} range={range} />
    </div>
  </div>
}

function TimelineEventBar({ segment, segmentStyle, labelBefore, labelHidden, labelWidth, privateEvent, label, coverUrl, onEventOpen, focused, onFocusClear }: { segment: TimelineSegment; segmentStyle: CSSProperties; labelBefore: boolean; labelHidden: boolean; labelWidth: number; privateEvent: boolean; label: string; coverUrl: string | null; onEventOpen: (event: EventItem) => void; focused?: boolean; onFocusClear?: () => void }) {
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const { barRef, hoverPlacement, updateHoverPlacement } = useContainedHoverPlacement('.timeline-scroll')
  const { event } = segment
  return <button ref={barRef} className={`timeline-event-bar ${segment.isSingleDay ? 'single-day' : ''} ${labelBefore ? 'label-before' : ''} ${labelHidden ? 'label-hidden' : ''} ${privateEvent ? 'private' : 'public'} ${focused ? 'focused' : ''} ${isEventPast(event) ? 'past' : ''} ${segment.continuesBefore ? 'continues-before' : ''} ${segment.continuesAfter ? 'continues-after' : ''} hover-${hoverPlacement.side}`} data-event-focus-id={event.id} style={{ ...segmentStyle, '--timeline-single-day-label-width': `${labelWidth}px`, '--calendar-hover-width': `${hoverPlacement.width}px`, '--calendar-hover-offset-y': `${hoverPlacement.offsetY}px`, '--calendar-hover-offset-x': `${hoverPlacement.offsetX}px` } as CSSProperties} type="button" data-lane={segment.lane} aria-label={`${label} · ${formatTimeRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay, dateLocale)}`} title={event.title} onPointerEnter={(pointerEvent) => updateHoverPlacement(pointerEvent.currentTarget)} onFocus={(focusEvent) => updateHoverPlacement(focusEvent.currentTarget)} onClick={() => { onFocusClear?.(); onEventOpen(event) }}><span className="timeline-event-diamond" aria-hidden="true" />{privateEvent && !segment.isSingleDay && <LockKeyhole size={12} aria-hidden="true" />}<span className="timeline-event-label">{event.title}</span>{isEventPast(event) && <span className="sr-only">{t('event.past')}</span>}<CalendarEventHoverPreview event={event} coverUrl={coverUrl} /></button>
}

export function TimelineView({ events, showVisibility, onEventOpen, focusRequest, focusedEventId, onFocusClear, communityFilter }: { events: EventItem[]; showVisibility: boolean; onEventOpen: (event: EventItem) => void; focusRequest?: EventFocusRequest | null; focusedEventId?: string | null; onFocusClear?: () => void; communityFilter?: string }) {
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const scheduledEvents = useMemo(() => events.filter((event) => event.startsAt), [events])
  const communities = useMemo(() => stableCommunities(scheduledEvents), [scheduledEvents])
  const [visibleMonth, setVisibleMonth] = useState(() => timelineMonthDate(new Date()))
  const selectedCommunityFilter = communityFilter ?? 'all'
  const [timelineSection, setTimelineSection] = useState(0)
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const handledFocusNonce = useRef<number | null>(null)
  const range = useMemo(() => timelineRangeForMonth(visibleMonth), [visibleMonth])
  const weeks = useMemo(() => Array.from({ length: range.days.length / 7 }, (_, index) => range.days.slice(index * 7, index * 7 + 7)), [range.days])
  const isNarrowTimeline = timelineViewportWidth > 0 && timelineViewportWidth < 680
  const weeksPerSection = isNarrowTimeline ? 1 : timelineWeeksPerSection
  const sectionCount = Math.max(1, Math.ceil(weeks.length / weeksPerSection))
  const currentSection = Math.min(timelineSection, sectionCount - 1)
  const visibleWeeks = useMemo(() => weeks.slice(currentSection * weeksPerSection, currentSection * weeksPerSection + weeksPerSection), [currentSection, weeks, weeksPerSection])
  const visibleDays = useMemo(() => visibleWeeks.flat(), [visibleWeeks])
  const sectionRange = useMemo(() => ({ ...range, startKey: visibleDays[0] || range.startKey, endKey: visibleDays[visibleDays.length - 1] || range.endKey, days: visibleDays }), [range, visibleDays])
  const groupedCommunities = useMemo(() => communities.filter((community) => selectedCommunityFilter === 'all' || community.id === selectedCommunityFilter).map((community) => {
    const communityEvents = scheduledEvents.filter((event) => (event.communityId || '__independent__') === community.id)
    const segments = buildTimelineSegments(communityEvents, sectionRange)
    return { ...community, segments, laneCount: segments.length ? Math.max(...segments.map((segment) => segment.lane)) + 1 : 0 }
  }).filter((community) => community.segments.length), [communities, scheduledEvents, sectionRange, selectedCommunityFilter])
  const todayKey = limaDateKey(new Date())
  const todayIndex = visibleDays.indexOf(todayKey)
  const currentLabelWidth = timelineViewportWidth > 0 ? Math.min(timelineLabelWidth, Math.max(120, Math.round(timelineViewportWidth * .26))) : timelineLabelWidth
  const availableAxisWidth = Math.max(0, timelineViewportWidth - currentLabelWidth)
  const fittedDayWidth = availableAxisWidth > 0 ? availableAxisWidth / visibleDays.length : timelineNormalDayWidth
  const dayWidth = Math.max(18, fittedDayWidth)
  const canvasStyle = timelineCssVariables(dayWidth, visibleDays.length, currentLabelWidth)
  const reservedCommunityRows = groupedCommunities.length ? Math.max(0, timelineDefaultCommunityRows - groupedCommunities.length) : 0
  const contentHeight = groupedCommunities.reduce((total, community) => total + Math.max(timelineCommunityRowHeight, community.laneCount * timelineLaneHeight + timelineTrackPadding), 0)
  const bodyStyle = { '--timeline-day-width': `${dayWidth}px`, '--timeline-day-count': String(visibleDays.length), '--timeline-axis-width': `${dayWidth * visibleDays.length}px`, '--timeline-today-offset': todayIndex >= 0 ? `${todayIndex * dayWidth + dayWidth / 2}px` : '0px', minHeight: `${Math.max(timelineDefaultCommunityRows * timelineCommunityRowHeight, contentHeight)}px` } as CSSProperties
  const isCurrentMonth = visibleMonth.getFullYear() === new Date().getFullYear() && visibleMonth.getMonth() === new Date().getMonth()

  useEffect(() => {
    if (selectedCommunityFilter === 'all') {
      setTimelineSection(0)
      return
    }
    const firstCommunityEvent = scheduledEvents
      .filter((item) => (item.communityId || '__independent__') === selectedCommunityFilter)
      .sort((first, second) => new Date(first.startsAt as string).getTime() - new Date(second.startsAt as string).getTime())[0]
    if (!firstCommunityEvent?.startsAt) {
      setTimelineSection(0)
      return
    }
    const targetMonth = monthDateForEvent(firstCommunityEvent)
    setVisibleMonth((current) => current.getFullYear() === targetMonth.getFullYear() && current.getMonth() === targetMonth.getMonth() ? current : targetMonth)
    setTimelineSection(timelineSectionForEvent(firstCommunityEvent, targetMonth, weeksPerSection))
  }, [scheduledEvents, selectedCommunityFilter, weeksPerSection])

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    setTimelineSection(0)
  }
  const returnToToday = () => {
    setVisibleMonth(timelineMonthDate(new Date()))
    setTimelineSection(0)
  }

  useEffect(() => {
    const viewport = timelineScrollRef.current
    if (!viewport) return
    const updateViewportWidth = () => setTimelineViewportWidth(viewport.clientWidth)
    updateViewportWidth()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateViewportWidth)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const focusEventId = focusRequest?.eventId
    const focusNonce = focusRequest?.nonce
    if (!focusEventId || focusNonce == null || handledFocusNonce.current === focusNonce) return
    const target = scheduledEvents.find((event) => event.id === focusEventId)
    if (!target?.startsAt) return
    const targetMonth = monthDateForEvent(target)
    if (targetMonth.getFullYear() !== visibleMonth.getFullYear() || targetMonth.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(targetMonth)
      setTimelineSection(0)
      return
    }
    const targetDayIndex = range.days.indexOf(limaDateKey(target.startsAt))
    if (targetDayIndex < 0) return
    const targetSection = Math.min(sectionCount - 1, Math.floor(Math.floor(targetDayIndex / 7) / weeksPerSection))
    if (currentSection !== targetSection) {
      setTimelineSection(targetSection)
      return
    }
    const frame = window.requestAnimationFrame(() => focusEventElement(focusEventId))
    handledFocusNonce.current = focusNonce
    return () => window.cancelAnimationFrame(frame)
  }, [currentSection, focusRequest, range, scheduledEvents, sectionCount, visibleMonth, weeksPerSection])

  return (
    <section className="timeline-view" aria-label={`${t('agenda.timeline')} · ${formatTimelineMonth(visibleMonth, dateLocale)}`}>
      <div className="timeline-toolbar">
        <div className="timeline-toolbar-main">
          <div className="timeline-month-heading">
            <h3 className="timeline-month-title">{formatTimelineMonth(visibleMonth, dateLocale)}</h3>
          </div>
          <div className="timeline-period-controls">
            <button className="timeline-control-button" type="button" aria-label={t('agenda.previousMonth')} onClick={() => changeMonth(-1)}><ChevronLeft size={17} /> <span>{t('agenda.previous')}</span></button>
            <button className={`timeline-control-button ${isCurrentMonth ? 'selected' : ''}`} type="button" onClick={returnToToday}><CalendarDays size={16} /> {t('agenda.today')}</button>
            <button className="timeline-control-button" type="button" aria-label={t('agenda.nextMonth')} onClick={() => changeMonth(1)}><span>{t('agenda.next')}</span> <ChevronRight size={17} /></button>
          </div>
        </div>
      </div>
      <div className="timeline-scroll" ref={timelineScrollRef} style={canvasStyle}>
        {sectionCount > 1 && <div className="timeline-board-controls" aria-label={t('agenda.filterSections')}>
          <button className="timeline-section-button" type="button" aria-label={t('agenda.showPreviousWeeks')} title={t('agenda.showPreviousWeeks')} disabled={currentSection === 0} onClick={() => setTimelineSection((section) => Math.max(0, section - 1))}><ChevronLeft size={14} /></button>
          <button className="timeline-section-button" type="button" aria-label={t('agenda.showNextWeeks')} title={t('agenda.showNextWeeks')} disabled={currentSection === sectionCount - 1} onClick={() => setTimelineSection((section) => Math.min(sectionCount - 1, section + 1))}><ChevronRight size={14} /></button>
        </div>}
        <div className="timeline-canvas">
          <div className="timeline-header-row timeline-week-header">
            <div className="timeline-label-header">{t('agenda.community')}</div>
            <div className="timeline-axis timeline-week-axis">{visibleWeeks.map((week) => <div className="timeline-week" style={{ gridColumn: `span ${week.length}` }} key={week[0]}>{formatTimelineWeek(week[0], week[week.length - 1], dateLocale)}</div>)}</div>
          </div>
          <div className="timeline-header-row timeline-day-header">
            <div className="timeline-label-header timeline-day-label">{t('agenda.events')}</div>
            <div className="timeline-axis timeline-day-axis">{visibleDays.map((key) => { const day = formatTimelineDay(key, dateLocale); return <div className={`timeline-day ${key === todayKey ? 'today' : ''} ${key < range.monthStartKey || key > range.monthEndKey ? 'outside-month' : ''}`} key={key}><span>{day.weekday}</span><strong>{day.day}</strong></div> })}</div>
          </div>
          <div className="timeline-body" style={bodyStyle}>
            {todayIndex >= 0 && <div className="timeline-today-line" aria-label={t('agenda.todayDate', { date: formatTimelineDay(todayKey, dateLocale).day, month: formatTimelineMonth(visibleMonth, dateLocale) })}><span>{t('agenda.today')}</span></div>}
            {groupedCommunities.length ? <>
              {groupedCommunities.map((community) => <div className="timeline-community-row" key={community.id}>
              <div className="timeline-community-label" style={timelineStyle(community.color)}><span className="timeline-community-dot" /><CommunityLogo path={community.logoPath} name={community.name} color={community.brandColor} size="small" decorative /><strong>{community.name}</strong><small>{community.segments.length} {t(community.segments.length === 1 ? 'agenda.oneEvent' : 'agenda.manyEvents')}</small></div>
              <div className="timeline-track" style={{ minHeight: `${Math.max(timelineCommunityRowHeight, community.laneCount * timelineLaneHeight + timelineTrackPadding)}px` }}>
                <TimelineDayGrid visibleDays={visibleDays} range={range} />
                {timelineSingleDayLabelLayouts(community.segments, visibleDays.length, dayWidth).map((labelLayout, index) => {
                  const segment = community.segments[index]
                  const privateEvent = showVisibility && segment.event.visibility === 'network'
                  const coverUrl = getEventCoverUrl(segment.event.coverPath)
                  const segmentWidth = segment.isSingleDay ? Math.min(28, dayWidth - 8) : (segment.endIndex - segment.startIndex + 1) * dayWidth - 8
                  const segmentLeft = segment.isSingleDay ? segment.startIndex * dayWidth + (dayWidth - segmentWidth) / 2 : segment.startIndex * dayWidth + 4
                  const segmentStyle = { ...timelineStyle(community.color), left: `${segmentLeft}px`, width: `${segmentWidth}px`, top: `${segment.lane * timelineLaneHeight + 10}px` }
                  const label = `${segment.event.title}, ${segment.event.communityName}, ${formatEventDateRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay, dateLocale)}${privateEvent ? `, ${t('event.network')}` : ''}`
                  return <TimelineEventBar key={segment.event.id} segment={segment} segmentStyle={segmentStyle} {...labelLayout} privateEvent={privateEvent} label={label} coverUrl={coverUrl} onEventOpen={onEventOpen} focused={focusedEventId === segment.event.id} onFocusClear={onFocusClear} />
                })}
              </div>
              </div>)}
              {Array.from({ length: reservedCommunityRows }, (_, index) => <TimelinePlaceholderRow key={`placeholder-${index}`} visibleDays={visibleDays} range={range} />)}
            </> : <div className="timeline-empty"><CalendarDays size={24} aria-hidden="true" /><strong>{t('agenda.noEventsSection')}</strong><span>{sectionCount > 1 ? t('agenda.navigateWeeks') : t('agenda.tryAnotherFilter')}</span></div>}
          </div>
        </div>
      </div>
    </section>
  )
}

export function EventFocusButton({ onClick, onPreviousClick, onNextClick, navigationActive = false, previousDisabled = false, nextDisabled = false }: { onClick: () => void; onPreviousClick?: () => void; onNextClick?: () => void; navigationActive?: boolean; previousDisabled?: boolean; nextDisabled?: boolean }) {
  const { t } = useLocale()
  const showNavigation = navigationActive || Boolean(onPreviousClick) || Boolean(onNextClick)
  return <div className="event-focus-actions">
    {showNavigation && <button className="event-previous-button" type="button" aria-label={t('agenda.previousEvent')} title={`${t('agenda.goTo')} ${t('agenda.previousEvent').toLowerCase()}`} disabled={previousDisabled || !onPreviousClick} onClick={onPreviousClick}><ChevronLeft size={18} aria-hidden="true" /></button>}
    <button className={`event-focus-button${navigationActive ? ' active' : ''}`} type="button" aria-label={t('agenda.nextEvent')} aria-pressed={navigationActive} title={navigationActive ? t('agenda.exitGuided') : `${t('agenda.goTo')} ${t('agenda.nextEvent').toLowerCase()}`} onClick={onClick}>
      <LocateFixed size={16} aria-hidden="true" />
      {!showNavigation && <span>{t('agenda.nextEvent')}</span>}
    </button>
    {showNavigation && <button className="event-next-button" type="button" aria-label={t('agenda.nextEvent')} title={`${t('agenda.goTo')} ${t('agenda.nextEvent').toLowerCase()}`} disabled={nextDisabled || !onNextClick} onClick={onNextClick}><ChevronRight size={18} aria-hidden="true" /></button>}
  </div>
}

type EventResultsProps = {
  events: EventItem[]
  viewMode: EventViewMode
  showVisibility: boolean
  onEventOpen: (event: EventItem) => void
  showViewLabel?: boolean
  showFocusButton?: boolean
  toolbarCenter?: ReactNode
  toolbarEnd?: ReactNode
  contentBefore?: ReactNode
  communityFilter?: string
  liveEventIds?: ReadonlySet<string>
  focusRequest?: EventFocusRequest | null
  onFocusRequestChange?: (request: EventFocusRequest | null) => void
}

const EVENT_CARDS_PAGE_SIZE = 6

export function EventResults({ events, viewMode, showVisibility, onEventOpen, showViewLabel = true, showFocusButton = true, toolbarCenter, toolbarEnd, contentBefore, communityFilter, liveEventIds, focusRequest: controlledFocusRequest, onFocusRequestChange }: EventResultsProps) {
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const [internalFocusRequest, setInternalFocusRequest] = useState<EventFocusRequest | null>(null)
  const [activeFocusEventId, setActiveFocusEventId] = useState<string | null>(null)
  const [visibleCardCount, setVisibleCardCount] = useState(EVENT_CARDS_PAGE_SIZE)
  const [pastEventsOpen, setPastEventsOpen] = useState(false)
  const focusNonce = useRef(0)
  const displayedEvents = useMemo(() => events.filter((event) => matchesCommunityFilter(event, communityFilter)), [communityFilter, events])
  const cardEvents = useMemo(() => {
    const upcomingEvents = displayedEvents.filter((event) => !isEventPast(event))
    const pastEvents = displayedEvents.filter((event) => isEventPast(event))
    return [...upcomingEvents, ...pastEvents]
  }, [displayedEvents])
  const visibleCardEvents = cardEvents.slice(0, visibleCardCount)
  const visibleUpcomingEvents = visibleCardEvents.filter((event) => !isEventPast(event))
  const visiblePastEvents = visibleCardEvents.filter((event) => isEventPast(event))
  const pastEventsId = 'past-events-list'
  const nextEvent = useMemo(() => findNextEvent(displayedEvents), [displayedEvents])
  const focusRequest = controlledFocusRequest === undefined ? internalFocusRequest : controlledFocusRequest
  const activeEventId = controlledFocusRequest === undefined ? activeFocusEventId : controlledFocusRequest?.eventId || null
  const previousEventBeforeFocus = useMemo(() => activeEventId ? findPreviousEventBefore(displayedEvents, activeEventId) : null, [activeEventId, displayedEvents])
  const nextEventAfterFocus = useMemo(() => activeEventId ? findNextEventAfter(displayedEvents, activeEventId) : null, [activeEventId, displayedEvents])

  useEffect(() => {
    setVisibleCardCount(EVENT_CARDS_PAGE_SIZE)
    setPastEventsOpen(false)
  }, [controlledFocusRequest, displayedEvents, viewMode])

  useEffect(() => {
    if (controlledFocusRequest !== undefined) return
    setActiveFocusEventId((current) => current && displayedEvents.some((event) => event.id === current) ? current : null)
    setInternalFocusRequest((current) => current && displayedEvents.some((event) => event.id === current.eventId) ? current : null)
  }, [controlledFocusRequest, displayedEvents])

  useEffect(() => {
    if (viewMode !== 'cards' || !focusRequest) return
    const frame = window.requestAnimationFrame(() => focusEventElement(focusRequest.eventId))
    return () => window.cancelAnimationFrame(frame)
  }, [displayedEvents, focusRequest, viewMode])

  const viewLabel = viewMode === 'cards' ? t('agenda.cards') : viewMode === 'calendar' ? t('agenda.calendar') : t('agenda.timeline')
  const requestEventFocus = (event: EventItem) => {
    if (viewMode === 'cards') {
      const eventIndex = cardEvents.findIndex((item) => item.id === event.id)
      if (eventIndex >= visibleCardCount) setVisibleCardCount(eventIndex + 1)
    }
    const request = { eventId: event.id, nonce: ++focusNonce.current }
    if (onFocusRequestChange) onFocusRequestChange(request)
    else {
      setActiveFocusEventId(event.id)
      setInternalFocusRequest(request)
    }
  }
  const requestFocus = () => { if (nextEvent) requestEventFocus(nextEvent) }
  const requestPreviousFocus = () => { if (previousEventBeforeFocus) requestEventFocus(previousEventBeforeFocus) }
  const requestNextFocus = () => { if (nextEventAfterFocus) requestEventFocus(nextEventAfterFocus) }
  const clearFocus = () => {
    if (onFocusRequestChange) onFocusRequestChange(null)
    else {
      setActiveFocusEventId(null)
      setInternalFocusRequest(null)
    }
  }
  const toggleFocus = () => { if (activeEventId) clearFocus(); else requestFocus() }
  const focusButton = showFocusButton && nextEvent ? <EventFocusButton onClick={toggleFocus} navigationActive={Boolean(activeEventId)} onPreviousClick={activeEventId ? requestPreviousFocus : undefined} onNextClick={activeEventId ? requestNextFocus : undefined} previousDisabled={!previousEventBeforeFocus} nextDisabled={!nextEventAfterFocus} /> : null
  const renderCardEvents = (eventsToRender: EventItem[], priorMonthLabel: string | null = null) => eventsToRender.map((event, index) => {
    const monthLabel = eventMonthLabel(event, dateLocale)
    const previousMonthLabel = index > 0 ? eventMonthLabel(eventsToRender[index - 1], dateLocale) : priorMonthLabel
    const shouldShowMonthDivider = monthLabel !== previousMonthLabel
    return <Fragment key={event.id}>
      {shouldShowMonthDivider && <div className="event-month-divider" role="separator" aria-label={`${t('agenda.month')} ${monthLabel}`}><span>{monthLabel}</span></div>}
      <EventCard event={event} showVisibility={showVisibility} focused={activeEventId === event.id} happeningNow={liveEventIds?.has(event.id)} onOpen={() => { clearFocus(); onEventOpen(event) }} />
    </Fragment>
  })
  const showToolbar = showViewLabel || Boolean(focusButton) || Boolean(toolbarCenter) || Boolean(toolbarEnd)
  return <div className="event-results">
    {showToolbar && <div className="event-results-toolbar">
      <div className="event-results-toolbar-start">
        {showViewLabel && <span>{t('agenda.view')}: {viewLabel}</span>}
        {!showViewLabel && focusButton}
      </div>
      <div className="event-results-toolbar-center">{toolbarCenter}</div>
      <div className="event-results-toolbar-end">
        {showViewLabel && focusButton}
        {toolbarEnd}
      </div>
    </div>}
    {contentBefore}
    {!displayedEvents.length && <EmptyEvents authenticated={showVisibility} />}
    {displayedEvents.length > 0 && <>
      {viewMode === 'calendar' && <CalendarView events={events} onEventOpen={onEventOpen} focusRequest={focusRequest} focusedEventId={activeEventId} onFocusClear={clearFocus} communityFilter={communityFilter} />}
      {viewMode === 'timeline' && <TimelineView events={events} showVisibility={showVisibility} onEventOpen={onEventOpen} focusRequest={focusRequest} focusedEventId={activeEventId} onFocusClear={clearFocus} communityFilter={communityFilter} />}
      {viewMode === 'cards' && <>
        <div className="event-list">
          {renderCardEvents(visibleUpcomingEvents)}
          {visiblePastEvents.length > 0 && <>
            <button className="event-list-divider" type="button" aria-expanded={pastEventsOpen} aria-controls={pastEventsId} onClick={() => setPastEventsOpen((current) => !current)}>
              <span>{t('agenda.pastEvents')}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            <div id={pastEventsId} className="event-list-past" hidden={!pastEventsOpen}>
              {renderCardEvents(visiblePastEvents, visibleUpcomingEvents.length ? eventMonthLabel(visibleUpcomingEvents[visibleUpcomingEvents.length - 1], dateLocale) : null)}
            </div>
          </>}
        </div>
        {visibleCardCount < cardEvents.length && <div className="event-load-more"><button className="secondary-button" type="button" onClick={() => setVisibleCardCount((current) => Math.min(current + EVENT_CARDS_PAGE_SIZE, cardEvents.length))}>{t('agenda.loadMore')}</button></div>}
      </>}
    </>}
  </div>
}
