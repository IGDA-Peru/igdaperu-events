import { CalendarDays, ChevronLeft, ChevronRight, LocateFixed, LockKeyhole, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatEventDateRange, formatTimeRange, isEventPast } from '../lib/format'
import type { EventItem } from '../types'
import { EmptyEvents, EventCard } from './EventCard'
import { CommunityLogo } from './CommunityLogo'
import { eventViewModes, type EventViewMode } from './eventViewModes'

export function EventViewSwitcher({ value, onChange }: { value: EventViewMode; onChange: (mode: EventViewMode) => void }) {
  return (
    <div className="view-switcher" role="group" aria-label="Vista de eventos">
      {eventViewModes.map(({ value: mode, label, Icon }) => (
        <button className={`view-switch ${value === mode ? 'selected' : ''}`} type="button" aria-pressed={value === mode} key={mode} onClick={() => onChange(mode)}>
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
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

export function CalendarView({ events, onEventOpen, focusRequest }: { events: EventItem[]; onEventOpen?: (event: EventItem) => void; focusRequest?: EventFocusRequest | null }) {
  const scheduledEvents = useMemo(() => events.filter((event) => event.startsAt), [events])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const monthLabel = capitalize(new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(visibleMonth))
  const days = useMemo(() => calendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()), [visibleMonth])
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7)), [days])
  const weekSegments = useMemo(() => weeks.map((week) => calendarEventSegments(week, scheduledEvents)), [weeks, scheduledEvents])
  const isCurrentMonth = visibleMonth.getFullYear() === new Date().getFullYear() && visibleMonth.getMonth() === new Date().getMonth()

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
        <h3>{monthLabel}</h3>
        <div className="calendar-actions">
          <button className={`calendar-today ${isCurrentMonth ? 'selected' : ''}`} type="button" onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}><CalendarDays size={15} /> Hoy</button>
          <button className="calendar-nav" type="button" aria-label="Mes anterior" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
          <button className="calendar-nav" type="button" aria-label="Mes siguiente" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-weekdays" aria-hidden="true">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {weeks.map((week, weekIndex) => {
            const segments = weekSegments[weekIndex]
            const laneCount = segments.length ? Math.max(...segments.map((segment) => segment.lane)) + 1 : 0
            const weekStyle = { minHeight: `${116 + laneCount * 27}px` } as CSSProperties
            return <div className="calendar-week" style={weekStyle} key={week[0].key}>
              <div className="calendar-week-days">
                {week.map(({ date, key, inMonth }) => {
                  const isToday = key === limaDateKey(new Date())
                  return <div className={`calendar-cell ${inMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}`} key={key}><span className="calendar-day-number">{date.getDate()}</span></div>
                })}
              </div>
              <div className="calendar-week-events" aria-label={`Eventos de la semana del ${week[0].key}`}>
                {segments.map((segment) => <button className={`calendar-event-bar ${segment.event.visibility === 'network' ? 'private' : 'public'} ${isEventPast(segment.event) ? 'past' : ''} ${segment.continuesBefore ? 'continues-before' : ''} ${segment.continuesAfter ? 'continues-after' : ''}`} data-event-focus-id={segment.event.id} type="button" style={{ gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`, gridRow: segment.lane + 1 }} title={`${segment.event.title} · ${formatEventDateRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay)} · ${formatTimeRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay)}`} aria-label={`${segment.event.title}, ${formatEventDateRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay)}`} onClick={() => onEventOpen?.(segment.event)} key={`${segment.event.id}-${week[0].key}`}>
                  {!segment.continuesBefore && <CommunityLogo path={segment.event.communityLogoPath} name={segment.event.communityName} size="small" decorative />}
                  {!segment.continuesBefore && <span className="calendar-event-dot" aria-hidden="true" />}
                  <span className="calendar-event-title">{segment.event.title}</span>
                </button>)}
              </div>
            </div>
          })}
        </div>
      </div>
    </section>
  )
}

export type TimelineZoom = 'compact' | 'normal' | 'detailed'

type TimelineZoomConfig = { label: string; dayWidth: number }

const timelineZoomConfig: Record<TimelineZoom, TimelineZoomConfig> = {
  compact: { label: 'Compacto', dayWidth: 30 },
  normal: { label: 'Normal', dayWidth: 38 },
  detailed: { label: 'Detallado', dayWidth: 54 },
}

const timelineZoomOrder: TimelineZoom[] = ['compact', 'normal', 'detailed']
const timelineWeeksPerSection = 3
const timelineLabelWidth = 190
const timelineWeekFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short' })
const timelineMonthFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', month: 'long', year: 'numeric' })
const timelineDayFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: 'numeric' })
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

function formatTimelineMonth(month: Date) {
  const label = timelineMonthFormatter.format(month).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatTimelineWeek(startKey: string, endKey: string) {
  return `${timelineWeekFormatter.format(dateFromKey(startKey)).replace('.', '')} – ${timelineWeekFormatter.format(dateFromKey(endKey)).replace('.', '')}`
}

function formatTimelineDay(key: string) {
  const label = timelineDayFormatter.format(dateFromKey(key)).replace('.', '')
  const [weekday, day] = label.split(' ')
  return { weekday: weekday.slice(0, 3), day }
}

type TimelineCommunity = { id: string; name: string; logoPath?: string | null; color: typeof timelinePalette[number] }

function stableCommunities(events: EventItem[]): TimelineCommunity[] {
  const communityMap = new Map<string, { id: string; name: string; logoPath?: string | null }>()
  events.forEach((event) => {
    if (!communityMap.has(event.communityId)) communityMap.set(event.communityId, { id: event.communityId, name: event.communityName, logoPath: event.communityLogoPath })
  })
  return [...communityMap.values()].sort((first, second) => first.name.localeCompare(second.name, 'es')).map((community, index) => ({ ...community, color: timelinePalette[index % timelinePalette.length] }))
}

function timelineCssVariables(dayWidth: number, dayCount: number): CSSProperties {
  return {
    '--timeline-day-width': `${dayWidth}px`,
    '--timeline-day-count': String(dayCount),
    '--timeline-axis-width': `${dayWidth * dayCount}px`,
    '--timeline-label-width': `${timelineLabelWidth}px`,
  } as CSSProperties
}

function timelineStyle(color: typeof timelinePalette[number]): CSSProperties {
  return { '--timeline-color': color.color, '--timeline-tint': color.tint } as CSSProperties
}

export function TimelineView({ events, showVisibility, onEventOpen, focusRequest }: { events: EventItem[]; showVisibility: boolean; onEventOpen: (event: EventItem) => void; focusRequest?: EventFocusRequest | null }) {
  const scheduledEvents = useMemo(() => events.filter((event) => event.startsAt), [events])
  const communities = useMemo(() => stableCommunities(scheduledEvents), [scheduledEvents])
  const [visibleMonth, setVisibleMonth] = useState(() => timelineMonthDate(new Date()))
  const [zoom, setZoom] = useState<TimelineZoom>('normal')
  const [communityFilter, setCommunityFilter] = useState('all')
  const [timelineSection, setTimelineSection] = useState(0)
  useEffect(() => {
    if (communityFilter !== 'all' && !communities.some((community) => community.id === communityFilter)) setCommunityFilter('all')
  }, [communities, communityFilter])

  const zoomConfig = timelineZoomConfig[zoom]
  const range = useMemo(() => timelineRangeForMonth(visibleMonth), [visibleMonth])
  const weeks = useMemo(() => Array.from({ length: range.days.length / 7 }, (_, index) => range.days.slice(index * 7, index * 7 + 7)), [range.days])
  const sectionCount = Math.max(1, Math.ceil(weeks.length / timelineWeeksPerSection))
  const currentSection = Math.min(timelineSection, sectionCount - 1)
  const visibleWeeks = useMemo(() => weeks.slice(currentSection * timelineWeeksPerSection, currentSection * timelineWeeksPerSection + timelineWeeksPerSection), [currentSection, weeks])
  const visibleDays = useMemo(() => visibleWeeks.flat(), [visibleWeeks])
  const sectionRange = useMemo(() => ({ ...range, startKey: visibleDays[0] || range.startKey, endKey: visibleDays[visibleDays.length - 1] || range.endKey, days: visibleDays }), [range, visibleDays])
  const groupedCommunities = useMemo(() => communities.filter((community) => communityFilter === 'all' || community.id === communityFilter).map((community) => {
    const communityEvents = scheduledEvents.filter((event) => event.communityId === community.id)
    const segments = buildTimelineSegments(communityEvents, sectionRange)
    return { ...community, segments, laneCount: segments.length ? Math.max(...segments.map((segment) => segment.lane)) + 1 : 0 }
  }).filter((community) => community.segments.length), [communities, communityFilter, scheduledEvents, sectionRange])
  const todayKey = limaDateKey(new Date())
  const todayIndex = visibleDays.indexOf(todayKey)
  const canvasStyle = timelineCssVariables(zoomConfig.dayWidth, visibleDays.length)
  const bodyStyle = { '--timeline-day-width': `${zoomConfig.dayWidth}px`, '--timeline-day-count': String(visibleDays.length), '--timeline-axis-width': `${zoomConfig.dayWidth * visibleDays.length}px`, '--timeline-today-offset': todayIndex >= 0 ? `${todayIndex * zoomConfig.dayWidth + zoomConfig.dayWidth / 2}px` : '0px' } as CSSProperties
  const decreaseZoom = () => setZoom((current) => timelineZoomOrder[Math.max(0, timelineZoomOrder.indexOf(current) - 1)])
  const increaseZoom = () => setZoom((current) => timelineZoomOrder[Math.min(timelineZoomOrder.length - 1, timelineZoomOrder.indexOf(current) + 1)])
  const isCurrentMonth = visibleMonth.getFullYear() === new Date().getFullYear() && visibleMonth.getMonth() === new Date().getMonth()
  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
    setTimelineSection(0)
  }
  const returnToToday = () => {
    setVisibleMonth(timelineMonthDate(new Date()))
    setTimelineSection(0)
  }

  useEffect(() => {
    const focusEventId = focusRequest?.eventId
    if (!focusEventId) return
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
    const targetSection = Math.min(sectionCount - 1, Math.floor(Math.floor(targetDayIndex / 7) / timelineWeeksPerSection))
    if (currentSection !== targetSection) {
      setTimelineSection(targetSection)
      return
    }
    const frame = window.requestAnimationFrame(() => focusEventElement(focusEventId))
    return () => window.cancelAnimationFrame(frame)
  }, [currentSection, focusRequest, range, scheduledEvents, sectionCount, visibleMonth])

  return (
    <section className="timeline-view" aria-label={`Línea de tiempo de ${formatTimelineMonth(visibleMonth)}`}>
      <div className="timeline-toolbar">
        <div className="timeline-toolbar-main">
          <div className="timeline-period-controls">
            <button className="timeline-control-button" type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /> <span>Anterior</span></button>
            <button className={`timeline-control-button ${isCurrentMonth ? 'selected' : ''}`} type="button" onClick={returnToToday}><CalendarDays size={16} /> Hoy</button>
            <button className="timeline-control-button" type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><span>Siguiente</span> <ChevronRight size={17} /></button>
          </div>
          <div className="timeline-month-heading">
            <h3 className="timeline-month-title">{formatTimelineMonth(visibleMonth)}</h3>
          </div>
          {sectionCount > 1 && <div className="timeline-section-controls" aria-label="Secciones del mes">
            <button className="timeline-section-button" type="button" aria-label="Sección anterior" title="Sección anterior" disabled={currentSection === 0} onClick={() => setTimelineSection((section) => Math.max(0, section - 1))}><ChevronLeft size={14} /></button>
            <span>Parte {currentSection + 1} de {sectionCount}</span>
            <button className="timeline-section-button" type="button" aria-label="Siguiente sección" title="Siguiente sección" disabled={currentSection === sectionCount - 1} onClick={() => setTimelineSection((section) => Math.min(sectionCount - 1, section + 1))}><ChevronRight size={14} /></button>
          </div>}
        </div>
        <div className="timeline-toolbar-filters">
          <div className="timeline-view-controls">
            <label className="timeline-community-filter"><span>Comunidad</span><select aria-label="Filtrar timeline por comunidad" value={communityFilter} onChange={(event) => { setCommunityFilter(event.target.value); setTimelineSection(0) }}><option value="all">Todas las comunidades</option>{communities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label>
            <div className="timeline-zoom" role="group" aria-label={`Zoom: ${zoomConfig.label}`}><span>Zoom</span><button type="button" aria-label="Reducir zoom" disabled={zoom === 'compact'} onClick={decreaseZoom}><Minus size={15} /></button><strong>{zoomConfig.label}</strong><button type="button" aria-label="Aumentar zoom" disabled={zoom === 'detailed'} onClick={increaseZoom}><Plus size={15} /></button></div>
          </div>
        </div>
      </div>
      <div className="timeline-legend" aria-label="Leyenda de comunidades">{communities.slice(0, 6).map((community) => <span key={community.id}><i style={timelineStyle(community.color)} />{community.name}</span>)}{showVisibility && <span><LockKeyhole size={13} aria-hidden="true" /> Solo la red</span>}</div>
      <div className="timeline-scroll" style={canvasStyle}>
        <div className="timeline-canvas">
          <div className="timeline-header-row timeline-week-header">
            <div className="timeline-label-header">Comunidad</div>
            <div className="timeline-axis timeline-week-axis">{visibleWeeks.map((week) => <div className="timeline-week" style={{ gridColumn: `span ${week.length}` }} key={week[0]}>{formatTimelineWeek(week[0], week[week.length - 1])}</div>)}</div>
          </div>
          <div className="timeline-header-row timeline-day-header">
            <div className="timeline-label-header timeline-day-label">Eventos</div>
            <div className="timeline-axis timeline-day-axis">{visibleDays.map((key) => { const day = formatTimelineDay(key); return <div className={`timeline-day ${key === todayKey ? 'today' : ''} ${key < range.monthStartKey || key > range.monthEndKey ? 'outside-month' : ''}`} key={key}><span>{day.weekday}</span><strong>{day.day}</strong></div> })}</div>
          </div>
          <div className="timeline-body" style={bodyStyle}>
            {todayIndex >= 0 && <div className="timeline-today-line" aria-label={`Hoy: ${formatTimelineDay(todayKey).day} de ${formatTimelineMonth(visibleMonth)}`}><span>Hoy</span></div>}
            {groupedCommunities.length ? groupedCommunities.map((community) => <div className="timeline-community-row" key={community.id}>
              <div className="timeline-community-label" style={timelineStyle(community.color)}><span className="timeline-community-dot" /><CommunityLogo path={community.logoPath} name={community.name} size="small" decorative /><strong>{community.name}</strong><small>{community.segments.length} {community.segments.length === 1 ? 'evento' : 'eventos'}</small></div>
              <div className="timeline-track" style={{ minHeight: `${Math.max(68, community.laneCount * 38 + 20)}px` }}>
                <div className="timeline-day-grid" aria-hidden="true">{visibleDays.map((key) => <span className={`${key < range.monthStartKey || key > range.monthEndKey ? 'outside-month' : ''} ${new Date(`${key}T12:00:00-05:00`).getDay() === 0 || new Date(`${key}T12:00:00-05:00`).getDay() === 6 ? 'weekend' : ''}`} key={key} />)}</div>
                {community.segments.map((segment) => {
                  const privateEvent = showVisibility && segment.event.visibility === 'network'
                  const labelBefore = segment.isSingleDay && segment.endIndex >= visibleDays.length - 2
                  const segmentWidth = segment.isSingleDay ? Math.min(28, zoomConfig.dayWidth - 8) : (segment.endIndex - segment.startIndex + 1) * zoomConfig.dayWidth - 8
                  const segmentLeft = segment.isSingleDay ? segment.startIndex * zoomConfig.dayWidth + (zoomConfig.dayWidth - segmentWidth) / 2 : segment.startIndex * zoomConfig.dayWidth + 4
                  const segmentStyle = { ...timelineStyle(community.color), left: `${segmentLeft}px`, width: `${segmentWidth}px`, top: `${segment.lane * 38 + 10}px` }
                  const label = `${segment.event.title}, ${segment.event.communityName}, ${formatEventDateRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay)}${privateEvent ? ', Solo la red' : ''}`
                  return <button className={`timeline-event-bar ${segment.isSingleDay ? 'single-day' : ''} ${labelBefore ? 'label-before' : ''} ${privateEvent ? 'private' : 'public'} ${isEventPast(segment.event) ? 'past' : ''} ${segment.continuesBefore ? 'continues-before' : ''} ${segment.continuesAfter ? 'continues-after' : ''}`} data-event-focus-id={segment.event.id} style={segmentStyle} type="button" data-lane={segment.lane} title={`${label} · ${formatTimeRange(segment.event.startsAt, segment.event.endsAt, segment.event.isAllDay)}`} aria-label={label} onClick={() => onEventOpen(segment.event)} key={segment.event.id}><span className="timeline-event-diamond" aria-hidden="true" />{privateEvent && !segment.isSingleDay && <LockKeyhole size={12} aria-hidden="true" />}<span className="timeline-event-label">{segment.event.title}</span>{isEventPast(segment.event) && <span className="sr-only">Ya pasó</span>}</button>
                })}
              </div>
            </div>) : <div className="timeline-empty"><CalendarDays size={24} aria-hidden="true" /><strong>No hay eventos en esta sección</strong><span>{sectionCount > 1 ? 'Usa las flechas bajo el mes para ver la siguiente sección.' : 'Prueba con otro mes o cambia el filtro de comunidad.'}</span></div>}
          </div>
        </div>
      </div>
    </section>
  )
}

function findNextEvent(events: EventItem[]) {
  const now = Date.now()
  const scheduled = events.filter((event) => event.startsAt && !isEventPast(event)).sort((first, second) => new Date(first.startsAt as string).getTime() - new Date(second.startsAt as string).getTime())
  return scheduled.find((event) => new Date(event.startsAt as string).getTime() >= now) || scheduled[0] || null
}

export function EventResults({ events, viewMode, showVisibility, onEventOpen }: { events: EventItem[]; viewMode: EventViewMode; showVisibility: boolean; onEventOpen: (event: EventItem) => void }) {
  const [focusRequest, setFocusRequest] = useState<EventFocusRequest | null>(null)
  const nextEvent = useMemo(() => findNextEvent(events), [events])

  useEffect(() => {
    if (viewMode !== 'cards' || !focusRequest) return
    const frame = window.requestAnimationFrame(() => focusEventElement(focusRequest.eventId))
    return () => window.cancelAnimationFrame(frame)
  }, [events, focusRequest, viewMode])

  if (!events.length) return <EmptyEvents authenticated={showVisibility} />
  const viewLabel = viewMode === 'cards' ? 'Tarjetas' : viewMode === 'calendar' ? 'Calendario' : 'Línea de tiempo'
  return <div className="event-results">
    <div className="event-results-toolbar">
      <span>Vista: {viewLabel}</span>
      {nextEvent && <button className="event-focus-button" type="button" onClick={() => setFocusRequest({ eventId: nextEvent.id, nonce: Date.now() })}><LocateFixed size={16} aria-hidden="true" /> Encontrar próximo evento</button>}
    </div>
    {viewMode === 'calendar' && <CalendarView events={events} onEventOpen={onEventOpen} focusRequest={focusRequest} />}
    {viewMode === 'timeline' && <TimelineView events={events} showVisibility={showVisibility} onEventOpen={onEventOpen} focusRequest={focusRequest} />}
    {viewMode === 'cards' && <div className="event-list">{events.map((event) => <EventCard event={event} showVisibility={showVisibility} onOpen={() => onEventOpen(event)} key={event.id} />)}</div>}
  </div>
}
