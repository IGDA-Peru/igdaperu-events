import { CalendarDays, Clock3, ExternalLink, MapPin, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getEventCoverUrl } from '../lib/data'
import { formatEventDateRange, formatEventLocation, formatTimeRange, isEventPast, meetingActionLabel } from '../lib/format'
import type { EventItem } from '../types'
import { VisibilityBadge } from './EventCard'
import { CommunityLogo } from './CommunityLogo'

type EventPreviewPresentation = 'drawer' | 'modal'

export function EventPreviewDrawer({
  event,
  onClose,
  presentation = 'drawer',
}: {
  event: EventItem | null
  onClose: () => void
  presentation?: EventPreviewPresentation
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!event) return
    const previousActiveElement = document.activeElement as HTMLElement | null
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      previousActiveElement?.focus()
    }
  }, [event, onClose])

  if (!event) return null
  const isPast = isEventPast(event)
  const coverUrl = getEventCoverUrl(event.coverPath)

  return createPortal(
    <div className={`event-preview-layer ${presentation === 'modal' ? 'event-preview-layer--modal' : ''}`} role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}>
      <aside className={`event-preview-drawer ${presentation === 'modal' ? 'event-preview-drawer--modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="event-preview-title">
        <div className="event-preview-topline">
        <div className="event-flags">
          <span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{event.type}</span>
          {isPast && <span className="event-past-label">Ya pasó</span>}
          {event.visibility === 'network' && <VisibilityBadge visibility={event.visibility} />}
          </div>
          <button className="event-preview-close" type="button" aria-label="Cerrar vista previa" ref={closeButtonRef} onClick={onClose}><X size={20} /></button>
        </div>
        {coverUrl && <img className="event-preview-cover" src={coverUrl} alt="" />}
        <h2 id="event-preview-title">{event.title}</h2>
        <p className="event-preview-description">{event.description}</p>
        <div className="event-preview-meta">
          <div><CalendarDays size={19} aria-hidden="true" /><span><strong>Fecha</strong>{formatEventDateRange(event.startsAt, event.endsAt, event.isAllDay)}</span></div>
          <div><Clock3 size={19} aria-hidden="true" /><span><strong>Hora</strong>{formatTimeRange(event.startsAt, event.endsAt, event.isAllDay)}</span></div>
          <div><MapPin size={19} aria-hidden="true" /><span><strong>Ubicación</strong>{formatEventLocation(event)}{event.mapUrl && <a href={event.mapUrl} target="_blank" rel="noreferrer">Ver en Google Maps <ExternalLink size={14} /></a>}</span></div>
          <div><CommunityLogo path={event.communityLogoPath} name={event.communityName} size="small" decorative /><span><strong>Organiza</strong>{presentation === 'modal' ? <a href="https://igda.pe/comunidad/" target="_top" rel="noreferrer">{event.communityName}</a> : <Link to={`/comunidades/${event.communitySlug}`} onClick={onClose}>{event.communityName}</Link>}</span></div>
        </div>
        {event.meetingUrl && !isPast && <a className="primary-button event-preview-link" href={event.meetingUrl} target="_blank" rel="noreferrer">{meetingActionLabel(event.meetingProvider)} <ExternalLink size={17} /></a>}
      </aside>
    </div>,
    document.body,
  )
}
