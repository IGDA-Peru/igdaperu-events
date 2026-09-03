import { CalendarDays, ChevronRight, Clock3, Globe2, LockKeyhole, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EventItem } from '../types'
import { formatDateParts, formatTimeRange } from '../lib/format'

export function EventCard({ event, compact = false, showVisibility = false }: { event: EventItem; compact?: boolean; showVisibility?: boolean }) {
  const parts = formatDateParts(event.startsAt)
  const isPrivate = event.visibility === 'network'
  return (
    <article className={`event-row ${compact ? 'compact' : ''} ${showVisibility ? (isPrivate ? 'private-event' : 'public-event') : ''}`}>
      <div className="event-date">
        <span>{parts.month}</span>
        <strong>{parts.date}</strong>
        <small>{parts.weekday}</small>
      </div>
      <div className={`event-accent ${event.type === 'TALLER' ? 'yellow' : 'red'}`} />
      <div className="event-details">
        <div className="event-flags">
          <span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{event.type}</span>
          {showVisibility && <span className={`visibility-badge ${isPrivate ? 'private' : 'public'}`}>{isPrivate ? <LockKeyhole size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />}{isPrivate ? 'Privado' : 'Público'}</span>}
        </div>
        <h3><Link to={`/eventos/${event.slug}`}>{event.title}</Link></h3>
        {!compact && <p>{event.description}</p>}
        <div className="event-meta">
          <span><MapPin size={15} aria-hidden="true" />{event.locationType === 'online' ? 'Online' : event.venueName || 'Perú'}</span>
          <span><Users size={15} aria-hidden="true" />{event.communityName}</span>
          <span><Clock3 size={15} aria-hidden="true" />{formatTimeRange(event.startsAt, event.endsAt)}</span>
        </div>
      </div>
      <Link className="event-arrow" to={`/eventos/${event.slug}`} aria-label={`Ver ${event.title}`}><ChevronRight size={28} /></Link>
    </article>
  )
}

export function EmptyEvents({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <div className="empty-state">
      <CalendarDays size={30} aria-hidden="true" />
      <h3>{authenticated ? 'No hay eventos en esta vista' : 'Aún no hay eventos públicos'}</h3>
      <p>Cuando una comunidad publique una actividad, aparecerá aquí.</p>
    </div>
  )
}
