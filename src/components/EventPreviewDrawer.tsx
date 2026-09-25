import { CalendarDays, Clock3, Copy, ExternalLink, MapPin, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { getEventCoverUrl } from '../lib/data'
import { formatEventDateRange, formatEventLocation, formatTimeRange, isEventPast } from '../lib/format'
import type { EventItem } from '../types'
import { VisibilityBadge } from './EventCard'
import { CommunityLogo } from './CommunityLogo'
import { localeTags, useLocale, withLocale } from '../i18n'

type EventPreviewPresentation = 'drawer' | 'modal'

function eventShareUrl(event: EventItem, locale: 'es' | 'en' | 'qu') {
  const url = new URL(withLocale('/', locale), window.location.origin)
  url.searchParams.set('evento', event.slug || event.id)
  return url.toString()
}

async function copyTextToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }
  } catch {
    // Continue with the legacy fallback when clipboard permissions are unavailable.
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.top = '0'
  textArea.style.left = '-9999px'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  const copied = typeof document.execCommand === 'function' && document.execCommand('copy')
  textArea.remove()
  if (!copied) throw new Error('Clipboard unavailable')
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
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const publicCommunityUrl = `https://igda.pe${withLocale('/comunidad/', locale)}`
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

  const copyEventLink = async () => {
    if (!event) return
    const url = eventShareUrl(event, locale)
    try {
      await copyTextToClipboard(url)
      setShareMessage(t('event.linkCopied'))
    } catch {
      setShareMessage(t('event.linkCopyError'))
    }
  }

  if (!event) return null
  const isPast = isEventPast(event)
  const coverUrl = getEventCoverUrl(event.coverPath)
  const drawerClassName = `event-preview-drawer ${presentation === 'modal' ? 'event-preview-drawer--modal' : ''}`
  const eventTypeLabel = t(`eventType.${event.type}`)
  const eventFlags = <div className="event-flags">
    <span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{eventTypeLabel.startsWith('eventType.') ? event.type : eventTypeLabel}</span>
    {isPast && <span className="event-past-label">{t('event.past')}</span>}
    {event.visibility === 'network' && <VisibilityBadge visibility={event.visibility} />}
  </div>

  return createPortal(
    <div className={`event-preview-layer ${presentation === 'modal' ? 'event-preview-layer--modal' : ''}`} role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}>
      <aside className={drawerClassName} style={{ '--community-color': event.communityColor || undefined } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="event-preview-title">
        {presentation === 'modal' ? <button className="event-preview-close" type="button" aria-label={t('event.closePreview')} ref={closeButtonRef} onClick={onClose}><X size={20} /></button> : <div className="event-preview-topline">{eventFlags}<button className="event-preview-close" type="button" aria-label={t('event.closePreview')} ref={closeButtonRef} onClick={onClose}><X size={20} /></button></div>}
        <div className={`event-preview-left-column${coverUrl ? '' : ' event-preview-left-column--no-cover'}`}>
          <div className="event-preview-card-heading">{presentation === 'modal' && eventFlags}<h2 id="event-preview-title">{event.title}</h2></div>
          {coverUrl && <div className="event-preview-cover-frame"><img className="event-preview-cover" src={coverUrl} alt="" /></div>}
          <p className="event-preview-description">{event.description}</p>
        </div>
        <div className="event-preview-right-column">
          <div className="event-preview-meta">
            <div className="event-preview-meta-item">
              <CalendarDays size={19} aria-hidden="true" />
              <div className="event-preview-meta-copy">
                <strong>{t('event.date')}</strong>
                <span className="event-preview-meta-value">{formatEventDateRange(event.startsAt, event.endsAt, event.isAllDay, dateLocale)}</span>
              </div>
            </div>
            <div className="event-preview-meta-item">
              <Clock3 size={19} aria-hidden="true" />
              <div className="event-preview-meta-copy">
                <strong>{t('event.time')}</strong>
                <span className="event-preview-meta-value">{formatTimeRange(event.startsAt, event.endsAt, event.isAllDay, dateLocale)}</span>
              </div>
            </div>
            <div className="event-preview-meta-item">
              <MapPin size={19} aria-hidden="true" />
              <div className="event-preview-meta-copy">
                <strong>{t('event.location')}</strong>
                <span className="event-preview-meta-value">{formatEventLocation(event, dateLocale)}</span>
                {event.accessMode !== 'registration_only' && event.mapUrl && <a className="event-preview-map-link" href={event.mapUrl} target="_blank" rel="noreferrer">{t('event.openMaps')} <ExternalLink size={14} aria-hidden="true" /></a>}
              </div>
            </div>
            {event.accessMode === 'registration_only' && event.registrationUrl && <div className="event-preview-meta-item">
              <ExternalLink size={19} aria-hidden="true" />
              <div className="event-preview-meta-copy">
                <strong>{t('event.registration')}</strong>
                <a className="event-preview-map-link event-preview-registration-link" href={event.registrationUrl} target="_blank" rel="noreferrer">{t('event.openRegistration')} <ExternalLink size={14} aria-hidden="true" /></a>
              </div>
            </div>}
            <div className="event-preview-meta-item">
              <CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="small" decorative />
              <div className="event-preview-meta-copy">
                <strong>{t('event.organizer')}</strong>
                <span className="event-preview-meta-value">{event.communityId ? <a href={publicCommunityUrl} target="_blank" rel="noreferrer">{event.communityName}</a> : (event.organizerName || event.communityName || t('event.independent'))}</span>
              </div>
            </div>
          </div>
          <div className="event-preview-actions">
            {!isPast && event.registrationUrl && <a className="primary-button event-preview-link" href={event.registrationUrl} target="_blank" rel="noreferrer">{t('event.register')} <ExternalLink size={17} /></a>}
            {!isPast && event.meetingUrl && <a className={`${event.registrationUrl ? 'secondary-button' : 'primary-button'} event-preview-link`} href={event.meetingUrl} target="_blank" rel="noreferrer">{event.meetingProvider === 'google_meet' ? t('event.joinMeet') : event.meetingProvider === 'zoom' ? t('event.joinZoom') : event.meetingProvider === 'discord' ? t('event.joinDiscord') : t('event.openMeeting')} <ExternalLink size={17} /></a>}
            <button className="secondary-button event-preview-link" type="button" onClick={() => void copyEventLink()}><Copy size={17} /> {t('event.copyLink')}</button>
            {shareMessage && <small className="event-share-message" role="status">{shareMessage}</small>}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
