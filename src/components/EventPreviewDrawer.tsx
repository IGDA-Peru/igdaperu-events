import { CalendarDays, Clock3, ExternalLink, MapPin, Share2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getEventCoverUrl } from '../lib/data'
import { formatEventDateRange, formatEventLocation, formatTimeRange, isEventPast, meetingActionLabel } from '../lib/format'
import type { EventItem } from '../types'
import { VisibilityBadge } from './EventCard'
import { CommunityLogo } from './CommunityLogo'

type EventPreviewPresentation = 'drawer' | 'modal'

function eventShareUrl(event: EventItem) {
  const url = new URL('/', window.location.origin)
  url.searchParams.set('evento', event.slug || event.id)
  return url.toString()
}

export function EventPreviewDrawer({
  event,
  onClose,
  presentation = 'modal',
}: {
  event: EventItem | null
  onClose: () => void
  presentation?: EventPreviewPresentation
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    setShareMessage('')
  }, [event])

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

  const shareEvent = async () => {
    if (!event) return
    const url = eventShareUrl(event)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: event.title, text: event.description, url })
        setShareMessage('Evento listo para compartir.')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareMessage('Enlace copiado.')
        return
      }
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
      setShareMessage('Enlace copiado.')
    } catch (reason) {
      if (reason && typeof reason === 'object' && 'name' in reason && reason.name === 'AbortError') return
      setShareMessage('No pudimos copiar el enlace.')
    }
  }

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
          <div><MapPin size={19} aria-hidden="true" /><span><strong>Ubicación</strong>{formatEventLocation(event)}{event.accessMode !== 'registration_only' && event.mapUrl && <a href={event.mapUrl} target="_blank" rel="noreferrer">Ver en Google Maps <ExternalLink size={14} /></a>}</span></div>
          <div><CommunityLogo path={event.communityLogoPath} name={event.communityName} size="small" decorative /><span><strong>Organiza</strong>{event.communityId ? presentation === 'modal' ? <a href="https://igda.pe/comunidad/" target="_top" rel="noreferrer">{event.communityName}</a> : <Link to={`/comunidades/${event.communitySlug}`} onClick={onClose}>{event.communityName}</Link> : <span>{event.organizerName || event.communityName || 'Evento independiente'}</span>}</span></div>
        </div>
        <div className="event-preview-actions">
          {!isPast && event.registrationUrl && <a className="primary-button event-preview-link" href={event.registrationUrl} target="_blank" rel="noreferrer">Inscribirme <ExternalLink size={17} /></a>}
          {!isPast && event.meetingUrl && <a className={`${event.registrationUrl ? 'secondary-button' : 'primary-button'} event-preview-link`} href={event.meetingUrl} target="_blank" rel="noreferrer">{meetingActionLabel(event.meetingProvider)} <ExternalLink size={17} /></a>}
          <button className="secondary-button event-preview-link" type="button" onClick={shareEvent}><Share2 size={17} /> Compartir evento</button>
          {shareMessage && <small className="event-share-message" role="status">{shareMessage}</small>}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
