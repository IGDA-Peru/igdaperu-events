import { Archive, CalendarDays, ChevronRight, Clock3, Edit3, Globe2, LockKeyhole, Mail, MapPin, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import type { EventItem, EventVisibility } from '../types'
import { getEventCoverUrl } from '../lib/data'
import { formatDateParts, formatEventLocation, formatEventSchedule, isEventPast } from '../lib/format'
import { CommunityLogo } from './CommunityLogo'
import { localeTags, useLocale } from '../i18n'

export function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const { t } = useLocale()
  const isPrivate = visibility === 'network'
  return <span className={`visibility-badge ${isPrivate ? 'private' : 'public'}`}>{isPrivate ? <LockKeyhole size={13} aria-hidden="true" /> : <Globe2 size={13} aria-hidden="true" />}{isPrivate ? t('event.network') : t('event.public')}</span>
}

type EventCardActions = { onArchive: () => void; onDelete: () => void; canDelete?: boolean }

function panelState(event: EventItem, isPast: boolean) {
  if (event.status === 'draft') return { label: 'event.draft', tone: 'draft' }
  if (event.status === 'archived') return { label: 'event.archived', tone: 'archived' }
  if (isPast) return { label: 'event.past', tone: 'archived' }
  if (event.visibility === 'network') return { label: 'event.network', tone: 'private' }
  return { label: 'event.public', tone: 'public' }
}

export function EventCard({ event, compact = false, showCover = false, showVisibility = false, panelActions, onOpen, focused = false, happeningNow = false }: { event: EventItem; compact?: boolean; showCover?: boolean; showVisibility?: boolean; panelActions?: EventCardActions; onOpen?: () => void; focused?: boolean; happeningNow?: boolean }) {
  const { locale, t } = useLocale()
  const dateLocale = localeTags[locale]
  const parts = formatDateParts(event.startsAt, dateLocale)
  const isPrivate = event.visibility === 'network'
  const isPast = isEventPast(event)
  const previewable = Boolean(onOpen)
  const managed = Boolean(panelActions)
  const state = panelState(event, isPast)
  const translatedType = t(`eventType.${event.type}`)
  const coverUrl = getEventCoverUrl(event.coverPath)
  const hasCover = Boolean(coverUrl) && (!compact || showCover)
  const audienceClass = managed || showVisibility ? (isPrivate ? 'private-event' : 'public-event') : ''
  const statusClass = managed && event.status === 'draft' ? 'draft-event' : managed && event.status === 'archived' ? 'archived-event' : ''
  const openPreview = (clickEvent: React.MouseEvent) => {
    clickEvent.stopPropagation()
    onOpen?.()
  }
  return (
    <article className={`event-row ${compact ? 'compact' : ''} ${hasCover ? 'has-cover' : ''} ${managed ? 'managed-event-card' : ''} ${previewable ? 'previewable-event' : ''} ${focused ? 'focused' : ''} ${isPast ? 'past-event' : ''} ${happeningNow ? 'live-event' : ''} ${audienceClass} ${statusClass}`} data-event-focus-id={event.id} style={{ '--community-color': event.communityColor || undefined } as CSSProperties} tabIndex={previewable ? -1 : undefined} onClick={previewable ? onOpen : undefined}>
      <div className="event-date">
        <span>{parts.month}</span>
        <strong>{parts.date}</strong>
        <small>{parts.weekday}</small>
      </div>
      <div className={`event-accent ${event.type === 'TALLER' ? 'yellow' : 'red'}`} />
      <div className="event-details">
        <div className="event-flags">
          {managed ? <span className={`panel-event-label ${state.tone}`}>{t(state.label)}</span> : <><span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{translatedType.startsWith('eventType.') ? event.type : translatedType}</span>{happeningNow && <span className="event-live-label"><span className="event-live-dot" aria-hidden="true" />{t('event.live')}</span>}{isPast && <span className="event-past-label">{t('event.past')}</span>}{showVisibility && isPrivate && <VisibilityBadge visibility={event.visibility} />}</>}
        </div>
        <h3>{previewable ? <button className="event-card-title" type="button" onClick={openPreview}>{event.title}</button> : <span className="event-card-title">{event.title}</span>}</h3>
        <div className="event-meta">
          <span><MapPin size={15} aria-hidden="true" />{formatEventLocation(event, dateLocale)}</span>
          <span><CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="small" decorative />{event.communityName}</span>
          <span className="event-time-meta"><Clock3 size={15} aria-hidden="true" />{formatEventSchedule(event.startsAt, event.endsAt, event.isAllDay, dateLocale)}</span>
          {managed && event.creatorEmail && <span className="event-creator-meta" title={t('event.emailCreator')}><Mail size={15} aria-hidden="true" />{t('event.createdBy', { email: event.creatorEmail })}</span>}
        </div>
      </div>
      {hasCover && <img className="event-card-cover" src={coverUrl || undefined} alt="" />}
      {panelActions ? <div className="event-card-actions" role="group" aria-label={t('event.actionsFor', { event: event.title })}>
        <Link className="event-card-action" to={`/app/eventos/${event.id}`} aria-label={t('event.editNamed', { event: event.title })} title={t('event.edit')}><Edit3 size={15} aria-hidden="true" /><span>{t('event.edit')}</span></Link>
        <button className="event-card-action" type="button" disabled={event.status === 'archived'} onClick={(clickEvent) => { clickEvent.stopPropagation(); panelActions.onArchive() }} aria-label={event.status === 'archived' ? t('event.archivedNamed', { event: event.title }) : t('event.archiveNamed', { event: event.title })} title={event.status === 'archived' ? t('event.alreadyArchived') : t('event.archive')}><Archive size={15} aria-hidden="true" /><span>{t('event.archive')}</span></button>
        {panelActions.canDelete !== false && <button className="event-card-action danger" type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); panelActions.onDelete() }} aria-label={t('event.deleteNamed', { event: event.title })} title={t('event.delete')}><Trash2 size={15} aria-hidden="true" /><span>{t('event.delete')}</span></button>}
      </div> : previewable ? <button className="event-arrow" type="button" aria-label={`${t('event.view')}: ${event.title}`} onClick={openPreview}><ChevronRight size={28} /></button> : null}
    </article>
  )
}

export function EmptyEvents({ authenticated = false }: { authenticated?: boolean }) {
  const { t } = useLocale()
  return (
    <div className="empty-state">
      <CalendarDays size={30} aria-hidden="true" />
      <h3>{authenticated ? t('agenda.noEventsView') : t('agenda.noEventsPublic')}</h3>
      <p>{t('agenda.noEventsDescription')}</p>
    </div>
  )
}
