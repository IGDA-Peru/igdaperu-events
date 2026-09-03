import { Archive, CalendarDays, ChevronRight, Clock3, Edit3, Globe2, LockKeyhole, MapPin, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EventItem, EventVisibility } from '../types'
import { formatDateParts, formatTimeRange, isEventPast } from '../lib/format'
import { CommunityLogo } from './CommunityLogo'

export function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const isPrivate = visibility === 'network'
  return <span className={`visibility-badge ${isPrivate ? 'private' : 'public'}`}>{isPrivate ? <LockKeyhole size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />}{isPrivate ? 'Solo la red' : 'Público'}</span>
}

type EventCardActions = { onArchive: () => void; onDelete: () => void; canDelete?: boolean }

function panelState(event: EventItem, isPast: boolean) {
  if (event.status === 'draft') return { label: 'Borrador', tone: 'draft' }
  if (isPast) return { label: 'Ya pasó', tone: 'archived' }
  if (event.status === 'archived') return { label: 'Archivado', tone: 'archived' }
  if (event.visibility === 'network') return { label: 'Solo la red', tone: 'private' }
  return { label: 'Público', tone: 'public' }
}

export function EventCard({ event, compact = false, showVisibility = false, panelActions, onOpen }: { event: EventItem; compact?: boolean; showVisibility?: boolean; panelActions?: EventCardActions; onOpen?: () => void }) {
  const parts = formatDateParts(event.startsAt)
  const isPrivate = event.visibility === 'network'
  const isPast = isEventPast(event)
  const previewable = Boolean(onOpen)
  const managed = Boolean(panelActions)
  const state = panelState(event, isPast)
  const openPreview = (clickEvent: React.MouseEvent) => {
    clickEvent.stopPropagation()
    onOpen?.()
  }
  return (
    <article className={`event-row ${compact ? 'compact' : ''} ${managed ? 'managed-event-card' : ''} ${previewable ? 'previewable-event' : ''} ${isPast ? 'past-event' : ''} ${showVisibility ? (isPrivate ? 'private-event' : 'public-event') : ''}`} onClick={previewable ? onOpen : undefined}>
      <div className="event-date">
        <span>{parts.month}</span>
        <strong>{parts.date}</strong>
        <small>{parts.weekday}</small>
      </div>
      <div className={`event-accent ${event.type === 'TALLER' ? 'yellow' : 'red'}`} />
      <div className="event-details">
        <div className="event-flags">
          {managed ? <span className={`panel-event-label ${state.tone}`}>{state.label}</span> : <><span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{event.type}</span>{isPast && <span className="event-past-label">Ya pasó</span>}{showVisibility && isPrivate && <VisibilityBadge visibility={event.visibility} />}</>}
        </div>
        <h3>{previewable ? <button className="event-card-title" type="button" onClick={openPreview}>{event.title}</button> : <Link to={`/eventos/${event.slug}`}>{event.title}</Link>}</h3>
        {!compact && <p>{event.description}</p>}
        <div className="event-meta">
          <span><MapPin size={15} aria-hidden="true" />{event.locationType === 'online' ? 'Online' : event.venueName || 'Perú'}</span>
          <span><CommunityLogo path={event.communityLogoPath} name={event.communityName} size="small" decorative />{event.communityName}</span>
          <span><Clock3 size={15} aria-hidden="true" />{formatTimeRange(event.startsAt, event.endsAt)}</span>
        </div>
      </div>
      {panelActions ? <div className="event-card-actions" role="group" aria-label={`Acciones para ${event.title}`}>
        <Link className="event-card-action" to={`/app/eventos/${event.id}`} aria-label={`Editar ${event.title}`} title="Editar evento"><Edit3 size={15} aria-hidden="true" /><span>Editar</span></Link>
        <button className="event-card-action" type="button" disabled={event.status === 'archived'} onClick={(clickEvent) => { clickEvent.stopPropagation(); panelActions.onArchive() }} aria-label={event.status === 'archived' ? `${event.title} ya está archivado` : `Archivar ${event.title}`} title={event.status === 'archived' ? 'Ya archivado' : 'Archivar evento'}><Archive size={15} aria-hidden="true" /><span>Archivar</span></button>
        {panelActions.canDelete !== false && <button className="event-card-action danger" type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); panelActions.onDelete() }} aria-label={`Eliminar ${event.title}`} title="Eliminar evento"><Trash2 size={15} aria-hidden="true" /><span>Eliminar</span></button>}
      </div> : previewable ? <button className="event-arrow" type="button" aria-label={`Ver ${event.title}`} onClick={openPreview}><ChevronRight size={28} /></button> : <Link className="event-arrow" to={`/eventos/${event.slug}`} aria-label={`Ver ${event.title}`}><ChevronRight size={28} /></Link>}
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
