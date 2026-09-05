import { ChevronRight, Code2, ExternalLink, Gamepad2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EventCard, EmptyEvents } from '../components/EventCard'
import { DemoNotice, ErrorState, LoadingState } from '../components/Feedback'
import { EventPreviewDrawer } from '../components/EventPreviewDrawer'
import { CommunityLogo } from '../components/CommunityLogo'
import { EventFilters } from '../components/EventFilters'
import { EventResults, EventViewSwitcher } from '../components/EventViews'
import type { EventViewMode } from '../components/eventViewModes'
import { filterEvents, type TimeFilter } from '../lib/eventFilters'
import { listCommunities, listEvents, listHomeEmbedEvents, type EventQueryOptions } from '../lib/data'
import type { Community, EventItem } from '../types'

const notionCommunitiesEmbedUrl = 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21'

function useEvents(options: EventQueryOptions = {}) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const key = JSON.stringify(options)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void listEvents(options).then((data) => {
      if (active) setEvents(data)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No pudimos cargar los eventos.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [key])

  return { events, loading, error }
}

function useHomeEmbedEvents(communitySlug?: string) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const key = communitySlug || ''

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void listHomeEmbedEvents(key || undefined).then((data) => {
      if (active) setEvents(data)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No pudimos cargar los eventos.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [key])

  return { events, loading, error }
}

function CommunityIcon({ index, logoPath, name, size = 'medium' }: { index: number; logoPath?: string | null; name?: string; size?: 'small' | 'medium' | 'large' }) {
  if (logoPath && name) return <CommunityLogo path={logoPath} name={name} size={size} decorative />
  const Icon = [Users, Gamepad2, Code2, Gamepad2, Users][index % 5]
  return <span className={`community-icon icon-${index % 2 ? 'yellow' : 'red'}`}><Icon size={24} strokeWidth={2.2} aria-hidden="true" /></span>
}

function CommunityRail({ communities }: { communities: Pick<Community, 'id' | 'slug' | 'name' | 'logoPath'>[] }) {
  return (
    <aside className="communities-panel" aria-labelledby="communities-title">
      <h2 id="communities-title">Comunidades</h2>
      <p>Explora más eventos de comunidades de la industria y afines.</p>
      <div className="community-list">
        {communities.slice(0, 5).map((community, index) => (
          <Link className="community-item" to={`/comunidades/${community.slug}`} key={community.id}>
            <CommunityIcon index={index} logoPath={community.logoPath} name={community.name} />
            <strong>{community.name}</strong>
          </Link>
        ))}
      </div>
      <Link className="all-communities" to="/comunidades">Ver todas las comunidades <ChevronRight size={19} /></Link>
    </aside>
  )
}

function getRecentCommunities(events: EventItem[]) {
  const latestByCommunity = new Map<string, { id: string; slug: string; name: string; logoPath?: string | null; latestAt: string }>()
  events.forEach((event) => {
    if (!event.startsAt) return
    const current = latestByCommunity.get(event.communityId)
    if (!current || new Date(event.startsAt) > new Date(current.latestAt)) {
      latestByCommunity.set(event.communityId, { id: event.communityId, slug: event.communitySlug, name: event.communityName, logoPath: event.communityLogoPath, latestAt: event.startsAt })
    }
  })
  return [...latestByCommunity.values()]
    .sort((first, second) => new Date(second.latestAt).getTime() - new Date(first.latestAt).getTime())
    .slice(0, 5)
}

export function PublicAgendaPage() {
  const { user, configured } = useAuth()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<EventViewMode>('cards')
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const { events, loading, error } = useEvents({ network: Boolean(user) })

  const visibleEvents = useMemo(() => {
    return filterEvents(events, { search, timeFilter, locationFilter })
  }, [events, locationFilter, search, timeFilter])

  const recentCommunities = useMemo(() => getRecentCommunities(events), [events])

  return (
    <div className="page-wrap page-wrap--events">
      {!configured && <DemoNotice />}
      {user && <div className="events-network-label"><span className="network-label">Público y privado</span></div>}
      <div className="content-grid">
        <section className="events-section" aria-labelledby="upcoming-title">
          <div className="section-heading-row"><h2 id="upcoming-title">Próximos eventos</h2><EventViewSwitcher value={viewMode} onChange={setViewMode} /></div>
          <EventFilters timeFilter={timeFilter} locationFilter={locationFilter} search={search} onTimeChange={setTimeFilter} onLocationChange={setLocationFilter} onSearchChange={setSearch} />
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {!loading && !error && <EventResults events={visibleEvents} viewMode={viewMode} showVisibility={Boolean(user)} onEventOpen={setSelectedEvent} />}
        </section>
        <CommunityRail communities={recentCommunities} />
      </div>
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}

export function CommunitiesPage() {
  return <div className="page-wrap page-wrap--communities"><section className="notion-communities-embed" aria-label="Directorio de comunidades IGDA Perú"><iframe src={notionCommunitiesEmbedUrl} title="Directorio de comunidades IGDA Perú" /><p className="notion-embed-fallback">¿No carga el directorio? <a href={notionCommunitiesEmbedUrl} target="_blank" rel="noreferrer">Abrirlo en Notion <ExternalLink size={15} /></a></p></section></div>
}

export function CommunityDetailPage() {
  const { slug = '' } = useParams()
  const [community, setCommunity] = useState<Community | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const { events, loading, error } = useEvents({ communitySlug: slug })
  useEffect(() => { void listCommunities().then((items) => setCommunity(items.find((item) => item.slug === slug) || null)) }, [slug])
  if (!community) return <LoadingState label="Cargando comunidad" />
  return <div className="page-wrap"><Link className="back-link" to="/comunidades"><ChevronRight size={18} className="back-icon" /> Todas las comunidades</Link><section className="community-hero"><CommunityIcon index={0} logoPath={community.logoPath} name={community.name} size="large" /><div className="community-hero-copy"><h1>{community.name}</h1><p>{community.description}</p>{community.websiteUrl && <a className="community-website-link" href={community.websiteUrl} target="_blank" rel="noreferrer">Visitar sitio principal <ExternalLink size={15} aria-hidden="true" /></a>}</div></section><div className="community-events"><h2>Eventos de {community.name}</h2>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />}</div><EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} /></div>
}

export function EmbedPage() {
  const [params] = useSearchParams()
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const communitySlug = params.get('community') || undefined
  const { events, loading, error } = useEvents({ communitySlug })
  return <div className="embed-page"><div className="embed-header"><span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>Eventos IGDA Perú</span></span><Link to="/" target="_blank">Ver todos los eventos <ExternalLink size={14} /></Link></div><h1>Próximos eventos</h1>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.slice(0, 4).map((event) => <EventCard event={event} compact onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />}<EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" /></div>
}

export function HomeEventsEmbedPage() {
  const [params] = useSearchParams()
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const communitySlug = params.get('community') || undefined
  const embedded = params.get('embedded') === '1'
  const { events, loading, error } = useHomeEmbedEvents(communitySlug)

  useEffect(() => {
    if (window.parent === window) return undefined

    const notifyParent = () => {
      window.parent.postMessage({
        type: 'igda-events-embed-height',
        height: document.body.scrollHeight + 24,
      }, '*')
    }

    notifyParent()
    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(notifyParent)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [events.length, loading, error])

  return (
    <div className={`home-events-embed-page${embedded ? ' home-events-embed-page--embedded' : ''}`}>
      <section className="home-events-embed" aria-labelledby="home-events-embed-title">
        <div className="home-events-embed-heading">
          <div>
            <span className="home-events-embed-kicker">Agenda</span>
            <h1 id="home-events-embed-title">Próximos eventos</h1>
            <p>Actividades de la comunidad IGDA Perú.</p>
          </div>
        </div>
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} compact onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />)}
        <div className="home-events-embed-cta-row">
          <a className="primary-button home-events-embed-cta" href="https://igda.pe/comunidad/calendario/" target="_top" rel="noreferrer">Ver todos los eventos <ExternalLink size={16} aria-hidden="true" /></a>
        </div>
      </section>
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
    </div>
  )
}
