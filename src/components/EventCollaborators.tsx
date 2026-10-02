import { Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { EventCollaborator } from '../types'
import { useLocale, withLocale } from '../i18n'
import { CommunityLogo } from './CommunityLogo'
import './EventCollaborators.css'

function safeContactUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function EventCollaborators({ collaborators = [], variant = 'inline', interactive = true }: { collaborators?: EventCollaborator[]; variant?: 'inline' | 'detail' | 'compact'; interactive?: boolean }) {
  const { locale, t } = useLocale()
  const confirmed = collaborators.filter((collaborator) => collaborator.status === 'accepted')
  if (!confirmed.length) return null

  return <div className={`event-collaborators event-collaborators--${variant}`}>
    <span className="event-collaborators-heading"><Users size={15} aria-hidden="true" />{t('event.inCollaboration')}</span>
    <div className="event-collaborator-list">
      {confirmed.map((collaborator) => {
        const content = <><CommunityLogo path={collaborator.logoPath} name={collaborator.name} color={collaborator.color} size="small" decorative /><span>{collaborator.name}</span></>
        const contactUrl = safeContactUrl(collaborator.contactUrl)
        if (interactive && collaborator.kind === 'community' && collaborator.communitySlug) {
          return <Link className="event-collaborator" key={collaborator.id} to={withLocale(`/comunidades/${encodeURIComponent(collaborator.communitySlug)}`, locale)} onClick={(event) => event.stopPropagation()}>{content}</Link>
        }
        if (interactive && contactUrl) {
          return <a className="event-collaborator" key={collaborator.id} href={contactUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{content}</a>
        }
        return <span className="event-collaborator" key={collaborator.id}>{content}</span>
      })}
    </div>
  </div>
}
