import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, formatTimeRange, isEventPast } from '../lib/format'
import type { EventItem } from '../types'
import { EmptyEvents, EventCard, VisibilityBadge } from './EventCard'
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

function CalendarView({ events }: { events: EventItem[] }) {
  const scheduledEvents = events.filter((event) => event.startsAt)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const reference = scheduledEvents[0] ? new Date(scheduledEvents[0].startsAt as string) : new Date()
    return new Date(reference.getFullYear(), reference.getMonth(), 1)
  })
  const monthLabel = capitalize(new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(visibleMonth))
  const days = useMemo(() => calendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()), [visibleMonth])
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EventItem[]>()
    scheduledEvents.forEach((event) => {
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(event.startsAt as string))
      grouped.set(key, [...(grouped.get(key) || []), event])
    })
    return grouped
  }, [scheduledEvents])

  return (
    <section className="calendar-view" aria-label={`Calendario de ${monthLabel}`}>
      <div className="calendar-header">
        <h3>{monthLabel}</h3>
        <div className="calendar-actions">
          <button className="calendar-nav" type="button" aria-label="Mes anterior" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
          <button className="calendar-nav" type="button" aria-label="Mes siguiente" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-weekdays" aria-hidden="true">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map(({ date, key, inMonth }) => {
            const dayEvents = eventsByDate.get(key) || []
            const isToday = key === new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
            return (
              <div className={`calendar-cell ${inMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}`} key={key}>
                <span className="calendar-day-number">{date.getDate()}</span>
                <div className="calendar-cell-events">
                  {dayEvents.slice(0, 3).map((event) => <Link className={`calendar-event ${event.visibility === 'network' ? 'private' : 'public'} ${isEventPast(event) ? 'past' : ''}`} title={event.title} to={`/eventos/${event.slug}`} key={event.id}><CommunityLogo path={event.communityLogoPath} name={event.communityName} size="small" decorative /><span className="calendar-event-dot" aria-hidden="true" /><span>{event.title}</span></Link>)}
                  {dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3} más</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function TimelineView({ events, showVisibility }: { events: EventItem[]; showVisibility: boolean }) {
  return (
    <section className="timeline-view" aria-label="Línea de tiempo">
      {events.map((event) => {
        const isPrivate = event.visibility === 'network'
        const isPast = isEventPast(event)
        return (
          <article className={`timeline-entry ${isPrivate ? 'private-event' : 'public-event'} ${isPast ? 'past-event' : ''}`} key={event.id}>
            <div className="timeline-rail" aria-hidden="true"><span /></div>
            <div className="timeline-date"><strong>{formatDate(event.startsAt)}</strong><small>{formatTimeRange(event.startsAt, event.endsAt)}</small></div>
            <div className="timeline-event">
              <div className="event-flags">
                <span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{event.type}</span>
                {isPast && <span className="event-past-label">Ya pasó</span>}
                {showVisibility && isPrivate && <VisibilityBadge visibility={event.visibility} />}
              </div>
              <h3><Link to={`/eventos/${event.slug}`}>{event.title}</Link></h3>
              <p>{event.description}</p>
              <div className="event-meta">
                <span><MapPin size={15} aria-hidden="true" />{event.locationType === 'online' ? 'Online' : event.venueName || 'Perú'}</span>
                <span><CommunityLogo path={event.communityLogoPath} name={event.communityName} size="small" decorative />{event.communityName}</span>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export function EventResults({ events, viewMode, showVisibility, onEventOpen }: { events: EventItem[]; viewMode: EventViewMode; showVisibility: boolean; onEventOpen?: (event: EventItem) => void }) {
  if (!events.length) return <EmptyEvents authenticated={showVisibility} />
  if (viewMode === 'calendar') return <CalendarView events={events} />
  if (viewMode === 'timeline') return <TimelineView events={events} showVisibility={showVisibility} />
  return <div className="event-list">{events.map((event) => <EventCard event={event} showVisibility={showVisibility} onOpen={onEventOpen ? () => onEventOpen(event) : undefined} key={event.id} />)}</div>
}
