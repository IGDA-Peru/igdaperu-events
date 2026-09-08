import { ChevronRight, Code2, ExternalLink, Gamepad2, Users } from 'lucide-react'
import { CalendarDays, CheckCircle2, Clock3, Link2, MapPin, Send, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EventCard, EmptyEvents } from '../components/EventCard'
import { DemoNotice, ErrorState, LoadingState } from '../components/Feedback'
import { EventPreviewDrawer } from '../components/EventPreviewDrawer'
import { CommunityLogo } from '../components/CommunityLogo'
import { EventFilters } from '../components/EventFilters'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { EventFocusButton, EventResults, EventViewSwitcher, type EventFocusRequest } from '../components/EventViews'
import type { EventViewMode } from '../components/eventViewModes'
import { filterEvents, type TimeFilter } from '../lib/eventFilters'
import { findNextEvent } from '../lib/eventFocus'
import { isSupabaseConfigured } from '../lib/supabase'
import { listCommunities, listEvents, listHomeEmbedEvents, submitEventProposal, type EventProposalSubmission, type EventQueryOptions } from '../lib/data'
import { limaNowDateTimeInput } from '../lib/eventSchedule'
import type { Community, EventItem } from '../types'

const notionCommunitiesEmbedUrl = 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21'

type ProposalFormState = Omit<EventProposalSubmission, 'turnstileToken'> & { turnstileToken: string }

const initialProposalForm: ProposalFormState = {
  organizerName: '',
  contactEmail: '',
  title: '',
  description: '',
  type: 'CHARLA',
  startsAt: '',
  endsAt: '',
  isAllDay: false,
  locationType: 'venue',
  accessMode: 'registration_only',
  locationPrecision: 'none',
  locationDepartment: '',
  locationProvince: '',
  venueName: '',
  address: '',
  mapUrl: '',
  placeId: '',
  formattedAddress: '',
  latitude: null,
  longitude: null,
  meetingUrl: '',
  meetingProvider: 'other',
  registrationUrl: '',
  turnstileToken: '',
  honeypot: '',
}

function localProposalDateTimeToIso(value: string) {
  if (!value) return ''
  const parsed = new Date(`${value}:00-05:00`)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

function ProposalFormField({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="proposal-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}</label>
}

export function EventProposalPage() {
  const [form, setForm] = useState(initialProposalForm)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const minimumDateTime = limaNowDateTimeInput()

  const update = <K extends keyof ProposalFormState>(key: K, value: ProposalFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const startsAt = localProposalDateTimeToIso(form.startsAt)
    const endsAt = localProposalDateTimeToIso(form.endsAt)
    if (!form.organizerName.trim() || !form.contactEmail.trim() || !form.title.trim() || !form.description.trim() || !startsAt || !endsAt) {
      setError('Completa los campos obligatorios antes de enviar la propuesta.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) {
      setError('Escribe un correo válido para poder contactarte si necesitamos aclarar algo.')
      return
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }
    if (new Date(startsAt) < new Date()) {
      setError('La fecha y hora de inicio no pueden estar en el pasado.')
      return
    }
    if (form.locationType !== 'venue' && !form.meetingUrl.trim()) {
      setError('Añade el enlace para unirse al evento online o híbrido.')
      return
    }
    if (isSupabaseConfigured && !form.turnstileToken) {
      setError('Completa la verificación antispam antes de enviar la propuesta.')
      return
    }

    setSaving(true)
    try {
      await submitEventProposal({ ...form, startsAt, endsAt })
      setSubmitted(true)
      setResetSignal((value) => value + 1)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos enviar la propuesta.')
    } finally {
      setSaving(false)
    }
  }

  if (submitted) return <div className="proposal-page"><section className="proposal-success" role="status"><CheckCircle2 size={54} aria-hidden="true" /><h1>Recibimos tu propuesta</h1><p>La revisaremos y, si hace falta, te contactaremos para completar o corregir la información.</p><small>Gracias por ayudar a visibilizar las actividades de la industria de videojuegos en Perú.</small><Link className="primary-button" to="/">Volver a la agenda</Link></section></div>

  return <div className="proposal-page">
    <section className="proposal-intro"><h1>Propón tu evento</h1><p>Cuéntanos sobre la actividad y el equipo de IGDA Perú la revisará antes de publicarla.</p></section>
    <form className="proposal-layout" onSubmit={(event) => void submit(event)}>
      <div className="proposal-form-panel">
        <div className="proposal-section-heading"><UserRound size={19} aria-hidden="true" /><div><h2>Información principal</h2><p>Comparte los datos que las personas necesitarán para conocer la actividad.</p></div></div>
        <div className="proposal-grid proposal-grid--two">
          <ProposalFormField label="Nombre del organizador o equipo" required><input required value={form.organizerName} onChange={(event) => update('organizerName', event.target.value)} placeholder="Ej. GameDev Lima" /></ProposalFormField>
          <ProposalFormField label="Correo de contacto" required><input required type="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder="tucorreo@ejemplo.com" /></ProposalFormField>
        </div>
        <ProposalFormField label="Título del evento" required><input required maxLength={180} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej. Charla: Diseño de sistemas para videojuegos" /></ProposalFormField>
        <div className="proposal-grid proposal-grid--two">
          <ProposalFormField label="Tipo de evento" required><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>CHARLA</option><option>TALLER</option><option>MEETUP</option><option>GAME JAM</option><option>CONFERENCIA</option></select></ProposalFormField>
          <ProposalFormField label="Enlace de inscripción"><div className="proposal-input-icon"><Link2 size={17} aria-hidden="true" /><input type="url" value={form.registrationUrl} onChange={(event) => update('registrationUrl', event.target.value)} placeholder="https://ejemplo.com/registro" /></div></ProposalFormField>
        </div>
        <ProposalFormField label="Descripción del evento" required><textarea required rows={6} maxLength={5000} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Cuéntanos de qué trata tu evento, a quién está dirigido y qué encontrarán las personas asistentes." /><small className="proposal-counter">{form.description.length}/5000</small></ProposalFormField>

        <div className="proposal-section-heading proposal-section-heading--spaced"><CalendarDays size={19} aria-hidden="true" /><div><h2>Fecha, hora y modalidad</h2><p>La fecha ayuda al equipo a ubicar tu actividad en la agenda.</p></div></div>
        <div className="proposal-grid proposal-grid--two">
          <ProposalFormField label="Fecha y hora de inicio" required><div className="proposal-input-icon"><CalendarDays size={17} aria-hidden="true" /><input required type="datetime-local" min={minimumDateTime} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></div></ProposalFormField>
          <ProposalFormField label="Fecha y hora de fin" required><div className="proposal-input-icon"><Clock3 size={17} aria-hidden="true" /><input required type="datetime-local" min={form.startsAt || minimumDateTime} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></div></ProposalFormField>
        </div>
        <fieldset className="proposal-choice-field"><legend>Modalidad <b aria-hidden="true">*</b></legend><div className="proposal-choice-grid">{([['venue', 'Presencial', 'El evento será presencial.'], ['online', 'Online', 'El evento se realizará en línea.'], ['hybrid', 'Híbrido', 'Combina actividades presenciales y en línea.']] as const).map(([value, label, description]) => <label className={`proposal-choice ${form.locationType === value ? 'selected' : ''}`} key={value}><input type="radio" name="proposal-location" value={value} checked={form.locationType === value} onChange={() => update('locationType', value)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset>

        {form.locationType !== 'online' && <div className="proposal-grid proposal-grid--two"><ProposalFormField label="Nombre del lugar"><div className="proposal-input-icon"><MapPin size={17} aria-hidden="true" /><input value={form.venueName} onChange={(event) => update('venueName', event.target.value)} placeholder="Ej. Centro Cultural de España" /></div></ProposalFormField><ProposalFormField label="Dirección"><input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Distrito, ciudad o dirección" /></ProposalFormField></div>}
        {form.locationType !== 'venue' && <ProposalFormField label="Enlace para unirse"><div className="proposal-input-icon"><Link2 size={17} aria-hidden="true" /><input type="url" value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="https://meet.google.com/..." /></div></ProposalFormField>}

        <div className="proposal-antispam"><TurnstileWidget action="event-proposal" value={form.turnstileToken} onChange={(value) => update('turnstileToken', value)} resetSignal={resetSignal} /></div>
        <label className="proposal-honeypot" aria-hidden="true">Sitio web<input tabIndex={-1} autoComplete="off" value={form.honeypot} onChange={(event) => update('honeypot', event.target.value)} /></label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button className="primary-button proposal-submit" type="submit" disabled={saving}><Send size={17} aria-hidden="true" />{saving ? 'Enviando propuesta…' : 'Enviar propuesta'}</button>
        <small className="proposal-legal">Al enviar confirmas que la información es correcta y que tienes autorización para compartirla.</small>
      </div>
      <aside className="proposal-info-panel"><CheckCircle2 size={38} aria-hidden="true" /><h2>Recibimos tu propuesta</h2><span className="proposal-info-line" /><p>La revisaremos y, si hace falta, te contactaremos para completar o corregir la información.</p><div className="proposal-info-divider" /><small>La publicación depende de la revisión del equipo de IGDA Perú.</small></aside>
    </form>
  </div>
}

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
    if (!event.startsAt || !event.communityId) return
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
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
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
  return <div className="page-wrap"><Link className="back-link" to="/comunidades"><ChevronRight size={18} className="back-icon" /> Todas las comunidades</Link><section className="community-hero"><CommunityIcon index={0} logoPath={community.logoPath} name={community.name} size="large" /><div className="community-hero-copy"><h1>{community.name}</h1><p>{community.description}</p>{community.websiteUrl && <a className="community-website-link" href={community.websiteUrl} target="_blank" rel="noreferrer">Visitar sitio principal <ExternalLink size={15} aria-hidden="true" /></a>}</div></section><div className="community-events"><h2>Eventos de {community.name}</h2>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />}</div><EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" /></div>
}

export function EmbedPage() {
  const [params] = useSearchParams()
  const [viewMode, setViewMode] = useState<EventViewMode>('calendar')
  const [focusRequest, setFocusRequest] = useState<EventFocusRequest | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const communitySlug = params.get('community') || undefined
  const { events, loading, error } = useEvents({ communitySlug })
  const nextEvent = useMemo(() => findNextEvent(events), [events])
  return <div className="embed-page"><div className="embed-header"><span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>Eventos IGDA Perú</span></span><Link to="/" target="_blank">Ver todos los eventos <ExternalLink size={14} /></Link></div><div className="embed-section-heading"><h1>Próximos eventos</h1><div className="embed-section-actions"><EventViewSwitcher value={viewMode} onChange={setViewMode} />{nextEvent && <EventFocusButton onClick={() => setFocusRequest({ eventId: nextEvent.id, nonce: Date.now() })} />}</div></div>{loading && <LoadingState />}{error && <ErrorState message={error} />}{!loading && !error && <EventResults events={events} viewMode={viewMode} showVisibility={false} onEventOpen={setSelectedEvent} showViewLabel={false} showFocusButton={false} focusRequest={focusRequest} onFocusRequestChange={setFocusRequest} />}<EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" /></div>
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
        {!loading && !error && (events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} compact showCover onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />)}
        <div className="home-events-embed-cta-row">
          <a className="primary-button home-events-embed-cta" href="https://igda.pe/comunidad/calendario/" target="_top" rel="noreferrer">Ver todos los eventos <ExternalLink size={16} aria-hidden="true" /></a>
        </div>
      </section>
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
    </div>
  )
}
