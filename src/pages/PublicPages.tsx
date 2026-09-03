import { CalendarDays, ChevronRight, Code2, ExternalLink, Gamepad2, MapPin, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EventCard, EmptyEvents } from '../components/EventCard'
import { DemoNotice, ErrorState, LoadingState } from '../components/Feedback'
import { createEventReport, getEventBySlug, listCommunities, listEvents } from '../lib/data'
import { formatDate, formatTimeRange } from '../lib/format'
import type { Community, EventItem } from '../types'

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

function CommunityIcon({ index }: { index: number }) {
  const Icon = [Users, Gamepad2, Code2, Gamepad2, Users][index % 5]
  return <span className={`community-icon icon-${index % 2 ? 'yellow' : 'red'}`}><Icon size={24} strokeWidth={2.2} aria-hidden="true" /></span>
}

function CommunityRail({ communities }: { communities: Community[] }) {
  return (
    <aside className="communities-panel" aria-labelledby="communities-title">
      <h2 id="communities-title">Comunidades</h2>
      <p>Explora más eventos de comunidades de la industria y afines.</p>
      <div className="community-list">
        {communities.slice(0, 5).map((community, index) => (
          <Link className="community-item" to={`/comunidades/${community.slug}`} key={community.id}>
            <CommunityIcon index={index} />
            <span><strong>{community.name}</strong><small>{community.description}</small></span>
            <ChevronRight className="community-arrow" size={21} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <Link className="all-communities" to="/comunidades">Ver todas las comunidades <ChevronRight size={19} /></Link>
      <footer>Impulsada por <strong>IGDA Perú</strong></footer>
    </aside>
  )
}

export function PublicAgendaPage() {
  const { user, configured } = useAuth()
  const [filter, setFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const { events, loading, error } = useEvents({ search, network: Boolean(user) })
  const [communities, setCommunities] = useState<Community[]>([])

  useEffect(() => {
    void listCommunities().then(setCommunities).catch(() => setCommunities([]))
  }, [])

  const visibleEvents = useMemo(() => {
    if (filter === 'Lima') return events.filter((event) => (event.address || event.venueName || '').toLowerCase().includes('lima'))
    if (filter === 'Este mes') {
      const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).format(new Date())
      return events.filter((event) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).format(new Date(event.startsAt)) === monthKey)
    }
    return events
  }, [events, filter])

  return (
    <div className="page-wrap">
      {!configured && <DemoNotice />}
      <section className="intro">
        <div>
          <h1>Agenda IGDA Perú</h1>
          <p>Descubre eventos, meetups, charlas y talleres de la comunidad de desarrollo de videojuegos en Perú.</p>
        </div>
        {user && <span className="network-label">Vista de la red autenticada</span>}
      </section>
      <div className="content-grid">
        <section className="events-section" aria-labelledby="upcoming-title">
          <div className="section-heading-row"><h2 id="upcoming-title">Próximos eventos</h2><label className="search-field"><Search size={17} /><span className="sr-only">Buscar eventos</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label></div>
          <div className="filters" aria-label="Filtrar eventos">
            {['Todos', 'Este mes', 'Lima'].map((item) => <button className={`filter-button ${filter === item ? 'selected' : ''}`} key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}{item === 'Este mes' && <CalendarDays size={16} />}</button>)}
          </div>
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {!loading && !error && (visibleEvents.length ? <div className="event-list">{visibleEvents.map((event) => <EventCard event={event} key={event.id} />)}</div> : <EmptyEvents authenticated={Boolean(user)} />)}
        </section>
        <CommunityRail communities={communities} />
      </div>
    </div>
  )
}

export function EventDetailPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [reportMessage, setReportMessage] = useState('')

  useEffect(() => {
    void getEventBySlug(slug, Boolean(user)).then(setEvent).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar el evento.')).finally(() => setLoading(false))
  }, [slug, user])

  if (loading) return <LoadingState label="Cargando evento" />
  if (error) return <ErrorState message={error} />
  if (!event) return <div className="empty-state"><h2>Evento no encontrado</h2><Link className="text-link" to="/">Volver a la agenda</Link></div>

  return (
    <div className="detail-page">
      <Link className="back-link" to="/"><ChevronRight size={18} className="back-icon" /> Volver a la agenda</Link>
      <article className="event-detail-card">
        <div className={`detail-color-bar ${event.type === 'TALLER' ? 'yellow' : 'red'}`} />
        <div className="detail-content">
          <span className={`event-type ${event.type === 'TALLER' ? 'yellow' : 'red'}`}>{event.type}</span>
          <h1>{event.title}</h1>
          <p className="detail-description">{event.description}</p>
          <div className="detail-meta">
            <div><CalendarDays size={19} /><span><strong>Fecha y hora</strong>{formatDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}</span></div>
            <div><MapPin size={19} /><span><strong>Ubicación</strong>{event.locationType === 'online' ? 'Online' : event.venueName || event.address || 'Por confirmar'}</span></div>
            <div><Users size={19} /><span><strong>Organiza</strong><Link to={`/comunidades/${event.communitySlug}`}>{event.communityName}</Link></span></div>
          </div>
          {event.meetingUrl && <a className="primary-button" href={event.meetingUrl} target="_blank" rel="noreferrer">Ver enlace del evento <ExternalLink size={17} /></a>}
          {user && <details className="report-box"><summary>Reportar este evento</summary><form onSubmit={(submitEvent) => { submitEvent.preventDefault(); void createEventReport(event.id, reportReason).then(() => { setReportMessage('Gracias. Revisaremos este reporte.'); setReportReason('') }).catch((reason: unknown) => setReportMessage(reason instanceof Error ? reason.message : 'No pudimos enviar el reporte.')) }}><label>Motivo<textarea required minLength={5} rows={3} value={reportReason} onChange={(inputEvent) => setReportReason(inputEvent.target.value)} placeholder="Cuéntanos qué debemos revisar" /></label><button className="secondary-button">Enviar reporte</button>{reportMessage && <p className="form-message success">{reportMessage}</p>}</form></details>}
        </div>
      </article>
    </div>
  )
}

export function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { void listCommunities().then(setCommunities).finally(() => setLoading(false)) }, [])
  return <div className="page-wrap"><div className="intro"><h1>Comunidades</h1><p>Encuentra los grupos, colectivos y organizaciones que mueven el desarrollo de videojuegos en Perú.</p></div>{loading ? <LoadingState label="Cargando comunidades" /> : <div className="community-directory">{communities.map((community, index) => <Link className="directory-item" to={`/comunidades/${community.slug}`} key={community.id}><CommunityIcon index={index} /><span><strong>{community.name}</strong><small>{community.description}</small></span><ChevronRight size={23} /></Link>)}</div>}</div>
}

export function CommunityDetailPage() {
  const { slug = '' } = useParams()
  const [community, setCommunity] = useState<Community | null>(null)
  const { events, loading, error } = useEvents({ communitySlug: slug })
  useEffect(() => { void listCommunities().then((items) => setCommunity(items.find((item) => item.slug === slug) || null)) }, [slug])
  if (!community) return <LoadingState label="Cargando comunidad" />
  return <div className="page-wrap"><Link className="back-link" to="/comunidades"><ChevronRight size={18} className="back-icon" /> Todas las comunidades</Link><section className="community-hero"><CommunityIcon index={0} /><div><h1>{community.name}</h1><p>{community.description}</p></div></section><div className="community-events"><h2>Eventos de {community.name}</h2>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div> : <EmptyEvents />}</div></div>
}

export function EmbedPage() {
  const [params] = useSearchParams()
  const communitySlug = params.get('community') || undefined
  const { events, loading, error } = useEvents({ communitySlug })
  return <div className="embed-page"><div className="embed-header"><span className="compact-brand"><CalendarDays size={18} /> Agenda IGDA Perú</span><Link to="/" target="_blank">Ver agenda completa <ExternalLink size={14} /></Link></div><h1>Próximos eventos</h1>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.slice(0, 4).map((event) => <EventCard event={event} compact key={event.id} />)}</div> : <EmptyEvents />}</div>
}
