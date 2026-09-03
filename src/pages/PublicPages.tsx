import { CalendarDays, ChevronRight, Code2, ExternalLink, Gamepad2, MapPin, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EventCard, EmptyEvents } from '../components/EventCard'
import { DemoNotice, ErrorState, LoadingState } from '../components/Feedback'
import { EventPreviewDrawer } from '../components/EventPreviewDrawer'
import { CommunityLogo } from '../components/CommunityLogo'
import { EventResults, EventViewSwitcher } from '../components/EventViews'
import type { EventViewMode } from '../components/eventViewModes'
import { getEventBySlug, listCommunities, listEvents } from '../lib/data'
import { formatDate, formatTimeRange, isEventPast, meetingActionLabel } from '../lib/format'
import type { Community, EventItem } from '../types'

const notionCommunitiesEmbedUrl = 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21'

function useEvents(options: { communitySlug?: string; search?: string; network?: boolean } = {}) {
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

function CommunityIcon({ index, logoPath, name }: { index: number; logoPath?: string | null; name?: string }) {
  if (logoPath && name) return <CommunityLogo path={logoPath} name={name} size="medium" decorative />
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
            <ChevronRight className="community-arrow" size={21} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <Link className="all-communities" to="/comunidades">Ver todas las comunidades <ChevronRight size={19} /></Link>
    </aside>
  )
}

const timeFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'next-month', label: 'Próximo mes' },
  { value: 'year', label: 'Este año' },
] as const

const peruDepartmentNames = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
  'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto',
  'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
] as const

const locationFilters = ['Todos', 'Internacional'] as const

function normalizeLocation(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function limaDateKey(value: string | Date | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function matchesTimeFilter(event: EventItem, filter: typeof timeFilters[number]['value']) {
  if (filter === 'all') return true
  if (!event.startsAt) return false
  const todayKey = limaDateKey(new Date())
  const eventKey = limaDateKey(event.startsAt)
  if (filter === 'today') return eventKey === todayKey

  const todayStart = new Date(`${todayKey}T00:00:00-05:00`)
  const eventDate = new Date(event.startsAt)
  if (filter === 'week') {
    const weekEnd = new Date(todayStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
    return eventDate >= todayStart && eventDate < weekEnd
  }

  const currentMonthKey = todayKey.slice(0, 7)
  if (filter === 'month') return eventKey.startsWith(currentMonthKey)
  if (filter === 'year') return eventKey.startsWith(todayKey.slice(0, 4))

  const nextMonth = new Date(todayStart)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  return eventKey.startsWith(limaDateKey(nextMonth).slice(0, 7))
}

function matchesLocationFilter(event: EventItem, filter: string) {
  if (filter === 'all') return true
  const location = normalizeLocation(`${event.venueName || ''} ${event.address || ''}`)
  if (filter === 'Internacional') {
    return Boolean(location) && !peruDepartmentNames.some((department) => location.includes(normalizeLocation(department)))
  }
  return location.includes(normalizeLocation(filter))
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
  const [timeFilter, setTimeFilter] = useState<typeof timeFilters[number]['value']>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<EventViewMode>('cards')
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const { events, loading, error } = useEvents({ network: Boolean(user) })

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      const matchesSearch = !query || `${event.title} ${event.description} ${event.communityName}`.toLowerCase().includes(query)
      return matchesSearch && matchesTimeFilter(event, timeFilter) && matchesLocationFilter(event, locationFilter)
    })
  }, [events, locationFilter, search, timeFilter])

  const recentCommunities = useMemo(() => getRecentCommunities(events), [events])

  return (
    <div className="page-wrap page-wrap--events">
      {!configured && <DemoNotice />}
      {user && <div className="events-network-label"><span className="network-label">Público y privado</span></div>}
      <div className="content-grid">
        <section className="events-section" aria-labelledby="upcoming-title">
          <div className="section-heading-row"><h2 id="upcoming-title">Próximos eventos</h2><EventViewSwitcher value={viewMode} onChange={setViewMode} /></div>
          <div className="events-toolbar">
            <div className="filter-controls" aria-label="Filtrar eventos">
              <label className="filter-control"><span className="filter-control-label"><CalendarDays size={14} aria-hidden="true" /> Tiempo</span><select aria-label="Tiempo" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)}>{timeFilters.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
              <label className="filter-control"><span className="filter-control-label"><MapPin size={14} aria-hidden="true" /> Lugar</span><select aria-label="Lugar" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>{locationFilters.map((location) => <option value={location === 'Todos' ? 'all' : location} key={location}>{location}</option>)}</select></label>
            </div>
            <label className="search-field"><Search size={17} /><span className="sr-only">Buscar eventos</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label>
          </div>
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

export function EventDetailPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void getEventBySlug(slug, Boolean(user)).then(setEvent).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar el evento.')).finally(() => setLoading(false))
  }, [slug, user])

  if (loading) return <LoadingState label="Cargando evento" />
  if (error) return <ErrorState message={error} />
  if (!event) return <div className="empty-state"><h2>Evento no encontrado</h2><Link className="text-link" to="/">Volver a eventos</Link></div>

  return (
    <div className="detail-page">
      <Link className="back-link" to="/"><ChevronRight size={18} className="back-icon" /> Volver a eventos</Link>
      <article className={`event-detail-card ${isEventPast(event) ? 'past-event' : ''}`}>
        <div className={`detail-color-bar ${event.type === 'TALLER' ? 'yellow' : 'red'}`} />
        <div className="detail-content">
          <span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{event.type}</span>
          {isEventPast(event) && <span className="event-past-label">Evento realizado</span>}
          <h1>{event.title}</h1>
          <p className="detail-description">{event.description}</p>
          <div className="detail-meta">
            <div><CalendarDays size={19} /><span><strong>Fecha y hora</strong>{formatDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}</span></div>
            <div><MapPin size={19} /><span><strong>Ubicación</strong>{event.locationType === 'online' ? 'Online' : event.venueName || event.address || 'Por confirmar'}{event.mapUrl && <a href={event.mapUrl} target="_blank" rel="noreferrer">Ver en Google Maps <ExternalLink size={14} /></a>}</span></div>
            <div><CommunityLogo path={event.communityLogoPath} name={event.communityName} size="small" decorative /><Users size={19} /><span><strong>Organiza</strong><Link to={`/comunidades/${event.communitySlug}`}>{event.communityName}</Link></span></div>
          </div>
          {event.meetingUrl && !isEventPast(event) && <a className="primary-button" href={event.meetingUrl} target="_blank" rel="noreferrer">{meetingActionLabel(event.meetingProvider)} <ExternalLink size={17} /></a>}
        </div>
      </article>
    </div>
  )
}

export function CommunitiesPage() {
  return <div className="page-wrap page-wrap--communities"><section className="notion-communities-embed" aria-label="Directorio de comunidades IGDA Perú"><iframe src={notionCommunitiesEmbedUrl} title="Directorio de comunidades IGDA Perú" /><p className="notion-embed-fallback">¿No carga el directorio? <a href={notionCommunitiesEmbedUrl} target="_blank" rel="noreferrer">Abrirlo en Notion <ExternalLink size={15} /></a></p></section></div>
}

export function CommunityDetailPage() {
  const { slug = '' } = useParams()
  const [community, setCommunity] = useState<Community | null>(null)
  const { events, loading, error } = useEvents({ communitySlug: slug })
  useEffect(() => { void listCommunities().then((items) => setCommunity(items.find((item) => item.slug === slug) || null)) }, [slug])
  if (!community) return <LoadingState label="Cargando comunidad" />
  return <div className="page-wrap"><Link className="back-link" to="/comunidades"><ChevronRight size={18} className="back-icon" /> Todas las comunidades</Link><section className="community-hero"><CommunityIcon index={0} logoPath={community.logoPath} name={community.name} /><div><h1>{community.name}</h1><p>{community.description}</p></div></section><div className="community-events"><h2>Eventos de {community.name}</h2>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div> : <EmptyEvents />}</div></div>
}

export function EmbedPage() {
  const [params] = useSearchParams()
  const communitySlug = params.get('community') || undefined
  const { events, loading, error } = useEvents({ communitySlug })
  return <div className="embed-page"><div className="embed-header"><span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>Eventos IGDA Perú</span></span><Link to="/" target="_blank">Ver todos los eventos <ExternalLink size={14} /></Link></div><h1>Próximos eventos</h1>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.slice(0, 4).map((event) => <EventCard event={event} compact key={event.id} />)}</div> : <EmptyEvents />}</div>
}
