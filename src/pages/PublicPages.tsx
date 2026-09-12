import { ArrowRight, ChevronDown, ChevronRight, Code2, Eye, ExternalLink, Gamepad2, PencilLine, Users } from 'lucide-react'
import { CalendarDays, CheckCircle2, Clock3, Link2, MapPin, Send, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
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
import { eventTypeOptions, isStandardEventType } from '../lib/eventTypes'
import { findNextEvent } from '../lib/eventFocus'
import { isSupabaseConfigured } from '../lib/supabase'
import { getEventCoverUrl, listCommunities, listEvents, listHomeEmbedEvents, submitEventProposal, type EventProposalSubmission, type EventQueryOptions } from '../lib/data'
import { limaNowDateTimeInput } from '../lib/eventSchedule'
import { EVENT_DESCRIPTION_MAX_LENGTH } from '../lib/eventLimits'
import { formatDateParts, formatEventLocation } from '../lib/format'
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

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

type ProposalErrorKey = 'organizerName' | 'contactEmail' | 'title' | 'type' | 'description' | 'startsAt' | 'endsAt' | 'meetingUrl' | 'registrationUrl'
type ProposalFieldErrors = Partial<Record<ProposalErrorKey, string>>

function ProposalFormField({ label, children, required = false, error }: { label: string; children: ReactNode; required?: boolean; error?: string }) {
  return <label className="proposal-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}{error && <small className="proposal-field-error" role="alert">{error}</small>}</label>
}

export function EventProposalPage() {
  const [form, setForm] = useState(initialProposalForm)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ProposalFieldErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const minimumDateTime = limaNowDateTimeInput()

  const update = <K extends keyof ProposalFormState>(key: K, value: ProposalFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
    if (key in fieldErrors) setFieldErrors((current) => { const next = { ...current }; delete next[key as ProposalErrorKey]; return next })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    const startsAt = localProposalDateTimeToIso(form.startsAt)
    const endsAt = localProposalDateTimeToIso(form.endsAt)
    const nextFieldErrors: ProposalFieldErrors = {}
    if (!form.organizerName.trim()) nextFieldErrors.organizerName = 'Falta este dato.'
    else if (form.organizerName.trim().length < 2) nextFieldErrors.organizerName = 'El nombre no es válido.'
    if (!form.contactEmail.trim()) nextFieldErrors.contactEmail = 'Falta este dato.'
    else if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) nextFieldErrors.contactEmail = 'El correo no es válido.'
    if (!form.title.trim()) nextFieldErrors.title = 'Falta este dato.'
    else if (form.title.trim().length < 3) nextFieldErrors.title = 'El título no es válido.'
    if (!form.type.trim() || form.type.trim().toUpperCase() === 'OTRO') nextFieldErrors.type = 'Especifica el tipo de evento.'
    else if (form.type.trim().length > 40) nextFieldErrors.type = 'El tipo de evento no puede superar 40 caracteres.'
    if (!form.description.trim()) nextFieldErrors.description = 'Falta este dato.'
    else if (form.description.trim().length < 3) nextFieldErrors.description = 'La descripción no es válida.'
    else if (form.description.trim().length > EVENT_DESCRIPTION_MAX_LENGTH) nextFieldErrors.description = `La descripción no puede superar ${EVENT_DESCRIPTION_MAX_LENGTH} caracteres.`
    if (!form.startsAt) nextFieldErrors.startsAt = 'Falta este dato.'
    else if (!startsAt) nextFieldErrors.startsAt = 'La fecha no es válida.'
    if (!form.endsAt) nextFieldErrors.endsAt = 'Falta este dato.'
    else if (!endsAt) nextFieldErrors.endsAt = 'La fecha no es válida.'
    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      setError('Revisa los campos marcados: falta un dato obligatorio o hay un dato inválido.')
      return
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setFieldErrors({ endsAt: 'La hora de fin debe ser posterior a la de inicio.' })
      setError('Revisa los campos marcados: hay un dato inválido.')
      return
    }
    if (new Date(startsAt) < new Date()) {
      setFieldErrors({ startsAt: 'La fecha y hora de inicio no pueden estar en el pasado.' })
      setError('Revisa los campos marcados: hay un dato inválido.')
      return
    }
    if (form.locationType !== 'venue' && !form.meetingUrl.trim()) {
      setFieldErrors({ meetingUrl: 'Falta el enlace para unirse al evento.' })
      setError('Revisa los campos marcados: falta un dato obligatorio.')
      return
    }
    if (form.registrationUrl.trim() && !isHttpUrl(form.registrationUrl.trim())) {
      setFieldErrors({ registrationUrl: 'El enlace debe comenzar con http:// o https://.' })
      setError('Revisa los campos marcados: hay un dato inválido.')
      return
    }
    if (form.meetingUrl.trim() && !isHttpUrl(form.meetingUrl.trim())) {
      setFieldErrors({ meetingUrl: 'El enlace debe comenzar con http:// o https://.' })
      setError('Revisa los campos marcados: hay un dato inválido.')
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
    <form className="proposal-layout" noValidate onSubmit={(event) => void submit(event)}>
      <div className="proposal-form-panel">
        <div className="proposal-section-heading"><UserRound size={19} aria-hidden="true" /><div><h2>Información principal</h2><p>Comparte los datos que las personas necesitarán para conocer la actividad.</p></div></div>
        <div className="proposal-grid proposal-grid--two">
          <ProposalFormField label="Nombre del organizador o equipo" required error={fieldErrors.organizerName}><input required aria-invalid={Boolean(fieldErrors.organizerName)} value={form.organizerName} onChange={(event) => update('organizerName', event.target.value)} placeholder="Ej. GameDev Lima" /></ProposalFormField>
          <ProposalFormField label="Correo de contacto" required error={fieldErrors.contactEmail}><input required aria-invalid={Boolean(fieldErrors.contactEmail)} type="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder="tucorreo@ejemplo.com" /></ProposalFormField>
        </div>
        <ProposalFormField label="Título del evento" required error={fieldErrors.title}><input required aria-invalid={Boolean(fieldErrors.title)} maxLength={180} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej. Charla: Diseño de sistemas para videojuegos" /></ProposalFormField>
        <div className="proposal-grid proposal-grid--two">
          <ProposalFormField label="Tipo de evento"><select value={isStandardEventType(form.type) ? form.type : 'OTRO'} onChange={(event) => update('type', event.target.value === 'OTRO' ? 'OTRO' : event.target.value)}>{eventTypeOptions.map((type) => <option key={type}>{type}</option>)}</select></ProposalFormField>
          <ProposalFormField label="Enlace de inscripción" error={fieldErrors.registrationUrl}><div className="proposal-input-icon"><Link2 size={17} aria-hidden="true" /><input aria-invalid={Boolean(fieldErrors.registrationUrl)} type="url" value={form.registrationUrl} onChange={(event) => update('registrationUrl', event.target.value)} placeholder="https://ejemplo.com/registro" /></div></ProposalFormField>
        </div>
        {!isStandardEventType(form.type) && <ProposalFormField label="Especifica el tipo de evento" required error={fieldErrors.type}><input required maxLength={40} aria-invalid={Boolean(fieldErrors.type)} value={form.type === 'OTRO' ? '' : form.type} onChange={(event) => update('type', event.target.value)} placeholder="Ej. Networking, festival, torneo…" /></ProposalFormField>}
        <ProposalFormField label="Descripción del evento" required error={fieldErrors.description}><textarea required aria-invalid={Boolean(fieldErrors.description)} rows={6} maxLength={EVENT_DESCRIPTION_MAX_LENGTH} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Cuéntanos de qué trata tu evento, a quién está dirigido y qué encontrarán las personas asistentes." /><small className="proposal-counter">{form.description.length}/{EVENT_DESCRIPTION_MAX_LENGTH}</small></ProposalFormField>

        <div className="proposal-section-heading proposal-section-heading--spaced"><CalendarDays size={19} aria-hidden="true" /><div><h2>Fecha, hora y modalidad</h2><p>La fecha ayuda al equipo a ubicar tu actividad en la agenda.</p></div></div>
        <div className="proposal-grid proposal-grid--two">
          <ProposalFormField label="Fecha y hora de inicio" required error={fieldErrors.startsAt}><div className="proposal-input-icon"><CalendarDays size={17} aria-hidden="true" /><input required aria-invalid={Boolean(fieldErrors.startsAt)} type="datetime-local" min={minimumDateTime} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></div></ProposalFormField>
          <ProposalFormField label="Fecha y hora de fin" required error={fieldErrors.endsAt}><div className="proposal-input-icon"><Clock3 size={17} aria-hidden="true" /><input required aria-invalid={Boolean(fieldErrors.endsAt)} type="datetime-local" min={form.startsAt || minimumDateTime} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></div></ProposalFormField>
        </div>
        <fieldset className="proposal-choice-field"><legend>Modalidad <b aria-hidden="true">*</b></legend><div className="proposal-choice-grid">{([['venue', 'Presencial', 'El evento será presencial.'], ['online', 'Online', 'El evento se realizará en línea.'], ['hybrid', 'Híbrido', 'Combina actividades presenciales y en línea.']] as const).map(([value, label, description]) => <label className={`proposal-choice ${form.locationType === value ? 'selected' : ''}`} key={value}><input type="radio" name="proposal-location" value={value} checked={form.locationType === value} onChange={() => update('locationType', value)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div></fieldset>

        {form.locationType !== 'online' && <div className="proposal-grid proposal-grid--two"><ProposalFormField label="Nombre del lugar"><div className="proposal-input-icon"><MapPin size={17} aria-hidden="true" /><input value={form.venueName} onChange={(event) => update('venueName', event.target.value)} placeholder="Ej. Centro Cultural de España" /></div></ProposalFormField><ProposalFormField label="Dirección"><input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Distrito, ciudad o dirección" /></ProposalFormField></div>}
        {form.locationType !== 'venue' && <ProposalFormField label="Enlace para unirse" required error={fieldErrors.meetingUrl}><div className="proposal-input-icon"><Link2 size={17} aria-hidden="true" /><input required aria-invalid={Boolean(fieldErrors.meetingUrl)} type="url" value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="https://meet.google.com/..." /></div></ProposalFormField>}

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

function CommunityIcon({ index, logoPath, name, brandColor, size = 'medium' }: { index: number; logoPath?: string | null; name?: string; brandColor?: string | null; size?: 'small' | 'medium' | 'large' }) {
  if (logoPath && name) return <CommunityLogo path={logoPath} name={name} color={brandColor} size={size} decorative />
  const Icon = [Users, Gamepad2, Code2, Gamepad2, Users][index % 5]
  return <span className={`community-icon icon-${index % 2 ? 'yellow' : 'red'}`}><Icon size={24} strokeWidth={2.2} aria-hidden="true" /></span>
}

function CommunityRail({ communities }: { communities: Pick<Community, 'id' | 'slug' | 'name' | 'logoPath' | 'brandColor'>[] }) {
  return (
    <aside className="communities-panel" aria-labelledby="communities-title">
      <h2 id="communities-title">Comunidades</h2>
      <p>Explora más eventos de comunidades de la industria y afines.</p>
      <div className="community-list">
        {communities.slice(0, 5).map((community, index) => (
          <Link className="community-item" to={`/comunidades/${community.slug}`} key={community.id}>
            <CommunityIcon index={index} logoPath={community.logoPath} name={community.name} brandColor={community.brandColor} />
            <strong>{community.name}</strong>
          </Link>
        ))}
      </div>
      <Link className="all-communities" to="/comunidades">Ver todas las comunidades <ChevronRight size={19} /></Link>
    </aside>
  )
}

type AgendaMode = 'editor' | 'public'

function initialAgendaModePanelOpen() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(max-width: 1100px)').matches
}

function AgendaModeToggle({ value, onChange, open, onToggle }: { value: AgendaMode; onChange: (mode: AgendaMode) => void; open: boolean; onToggle: () => void }) {
  return (
    <div className={`agenda-mode-shell ${open ? 'is-open' : ''}`}>
      <button className="agenda-mode-trigger" type="button" aria-expanded={open} aria-controls="agenda-mode-panel" onClick={onToggle}>
        <Eye size={17} aria-hidden="true" />
        <span>Visualización</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <aside id="agenda-mode-panel" className="agenda-mode-toggle" aria-labelledby="agenda-mode-title">
        <div className="agenda-mode-heading">
          <span id="agenda-mode-title" className="agenda-mode-kicker">Visualización</span>
        </div>
        <div className="agenda-mode-control" role="group" aria-label="Modo de visualización">
          <button className={`agenda-mode-option ${value === 'editor' ? 'selected' : ''}`} type="button" aria-pressed={value === 'editor'} onClick={() => onChange('editor')}>
            <PencilLine size={16} aria-hidden="true" />
            <span>Modo editor</span>
          </button>
          <button className={`agenda-mode-option ${value === 'public' ? 'selected' : ''}`} type="button" aria-pressed={value === 'public'} onClick={() => onChange('public')}>
            <Eye size={16} aria-hidden="true" />
            <span>Modo público</span>
          </button>
        </div>
      </aside>
    </div>
  )
}

function getRecentCommunities(events: EventItem[]) {
  const latestByCommunity = new Map<string, { id: string; slug: string; name: string; logoPath?: string | null; brandColor?: string | null; latestAt: string }>()
  events.forEach((event) => {
    if (!event.startsAt || !event.communityId) return
    const current = latestByCommunity.get(event.communityId)
    if (!current || new Date(event.startsAt) > new Date(current.latestAt)) {
      latestByCommunity.set(event.communityId, { id: event.communityId, slug: event.communitySlug, name: event.communityName, logoPath: event.communityLogoPath, brandColor: event.communityColor, latestAt: event.startsAt })
    }
  })
  return [...latestByCommunity.values()]
    .sort((first, second) => new Date(second.latestAt).getTime() - new Date(first.latestAt).getTime())
    .slice(0, 5)
}

export function PublicAgendaPage() {
  const { user, configured } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<EventViewMode>('cards')
  const [agendaMode, setAgendaMode] = useState<AgendaMode>('editor')
  const [modePanelOpen, setModePanelOpen] = useState(initialAgendaModePanelOpen)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const editorMode = Boolean(user && agendaMode === 'editor')
  const { events, loading, error } = useEvents({ network: editorMode })
  const sharedEventKey = searchParams.get('evento')

  useEffect(() => {
    if (loading || !sharedEventKey) return
    const sharedEvent = events.find((event) => event.id === sharedEventKey || event.slug === sharedEventKey)
    if (!sharedEvent) return
    setSelectedEvent(sharedEvent)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('evento')
      return next
    }, { replace: true })
  }, [events, loading, setSearchParams, sharedEventKey])

  const visibleEvents = useMemo(() => {
    return filterEvents(events, { search, timeFilter, locationFilter })
  }, [events, locationFilter, search, timeFilter])

  const recentCommunities = useMemo(() => getRecentCommunities(events), [events])

  return (
    <div className="page-wrap page-wrap--events">
      {!configured && <DemoNotice />}
      <div className="content-grid">
        <section className="events-section" aria-labelledby="upcoming-title">
          <div className="section-heading-row"><h2 id="upcoming-title">Próximos eventos</h2><EventViewSwitcher value={viewMode} onChange={setViewMode} /></div>
          <EventFilters timeFilter={timeFilter} locationFilter={locationFilter} search={search} onTimeChange={setTimeFilter} onLocationChange={setLocationFilter} onSearchChange={setSearch} />
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {!loading && !error && <EventResults events={visibleEvents} viewMode={viewMode} showVisibility={editorMode} onEventOpen={setSelectedEvent} showViewLabel={false} />}
        </section>
        <div className="events-sidebar">
          <CommunityRail communities={recentCommunities} />
          {user && <AgendaModeToggle value={agendaMode} onChange={setAgendaMode} open={modePanelOpen} onToggle={() => setModePanelOpen((current) => !current)} />}
        </div>
      </div>
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
    </div>
  )
}

export function HomeSpotlightPreviewPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type !== 'igda-events-embed-height') return

      const height = Number(event.data.height)
      if (!Number.isFinite(height)) return
      iframeRef.current.style.height = `${Math.max(420, Math.min(height, 2400))}px`
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return <div className="home-spotlight-preview">
    <div className="home-spotlight-preview-header">
      <div>
        <span className="home-spotlight-preview-kicker">Vista previa local</span>
        <h1>Spotlight de eventos</h1>
        <p>Así se vería el embed dentro de la página de inicio de igda.pe.</p>
      </div>
      <Link className="secondary-button" to="/">Volver a la agenda</Link>
    </div>
    <div className="home-spotlight-preview-frame">
      <iframe ref={iframeRef} src="/embed/spotlight?embedded=1" title="Vista previa del embed Spotlight" height="760" />
    </div>
  </div>
}

export function HomePage() {
  const [params] = useSearchParams()
  return params.get('spotlight') === '1' ? <HomeSpotlightPreviewPage /> : <PublicAgendaPage />
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
  return <div className="page-wrap"><Link className="back-link" to="/comunidades"><ChevronRight size={18} className="back-icon" /> Todas las comunidades</Link><section className="community-hero"><CommunityIcon index={0} logoPath={community.logoPath} name={community.name} brandColor={community.brandColor} size="large" /><div className="community-hero-copy"><h1>{community.name}</h1><p>{community.description}</p>{community.websiteUrl && <a className="community-website-link" href={community.websiteUrl} target="_blank" rel="noreferrer">Visitar sitio principal <ExternalLink size={15} aria-hidden="true" /></a>}</div></section><div className="community-events"><h2>Eventos de {community.name}</h2>{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />}</div><EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" /></div>
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

function SpotlightEventMedia({ event, size, showCommunityLogo = false }: { event: EventItem; size: 'feature' | 'small'; showCommunityLogo?: boolean }) {
  const coverUrl = getEventCoverUrl(event.coverPath)
  return <div className={`spotlight-event-media spotlight-event-media--${size}${coverUrl ? '' : ' spotlight-event-media--fallback'}`} style={{ '--community-color': event.communityColor || undefined } as CSSProperties}>
    {coverUrl ? <img src={coverUrl} alt="" /> : <CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size={size === 'feature' ? 'large' : 'medium'} decorative />}
    {coverUrl && showCommunityLogo && <CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="small" decorative />}
  </div>
}

function SpotlightEventDate({ event, large = false }: { event: EventItem; large?: boolean }) {
  const parts = formatDateParts(event.startsAt)
  return <time className={`spotlight-event-date${large ? ' spotlight-event-date--large' : ''}`} dateTime={event.startsAt || undefined}>
    <span>{parts.weekday}</span>
    <strong>{parts.date}</strong>
    <small>{parts.month}</small>
  </time>
}

function SpotlightEventLocation({ event }: { event: EventItem }) {
  return <span className="spotlight-event-location"><MapPin size={15} aria-hidden="true" />{formatEventLocation(event)}</span>
}

function SpotlightFeature({ event, onOpen }: { event: EventItem; onOpen: () => void }) {
  const hasCover = Boolean(getEventCoverUrl(event.coverPath))
  return <article className={`spotlight-feature-card spotlight-feature-card--interactive${hasCover ? '' : ' spotlight-feature-card--no-media'}`} style={{ '--community-color': event.communityColor || undefined } as CSSProperties} onClick={(interaction) => {
    if ((interaction.target as HTMLElement).closest('a, button')) return
    onOpen()
  }}>
    {hasCover && <div className="spotlight-feature-media">
      <SpotlightEventMedia event={event} size="feature" />
      <span className="spotlight-feature-badge">Próximo evento</span>
    </div>}
    <div className="spotlight-feature-body">
      <SpotlightEventDate event={event} large />
      <div className="spotlight-feature-copy">
        <div className="spotlight-feature-eyebrow">
          {!hasCover && <span className="spotlight-feature-badge spotlight-feature-badge--inline">Próximo evento</span>}
          <span className="spotlight-event-type">{event.type}</span>
        </div>
        <h2><button className="spotlight-feature-title" type="button" onClick={onOpen}>{event.title}</button></h2>
        <SpotlightEventLocation event={event} />
        <p>{event.description}</p>
        <div className="spotlight-feature-community"><CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="small" decorative /><span>Organiza {event.communityName}</span></div>
      </div>
      {event.registrationUrl ? <a className="primary-button spotlight-feature-action spotlight-feature-action--registration" href={event.registrationUrl} target="_blank" rel="noreferrer">Inscribirme <ExternalLink size={16} aria-hidden="true" /></a> : <button className="spotlight-feature-action spotlight-feature-action--icon" aria-label="Ver evento" type="button" onClick={onOpen}><ChevronRight size={24} aria-hidden="true" /></button>}
    </div>
  </article>
}

function SpotlightUpcomingItem({ event, onOpen }: { event: EventItem; onOpen: () => void }) {
  return <button className="spotlight-upcoming-item" type="button" onClick={onOpen} aria-label={`Ver ${event.title}`}>
    <SpotlightEventMedia event={event} size="small" showCommunityLogo />
    <SpotlightEventDate event={event} />
    <span className="spotlight-upcoming-copy">
      <strong>{event.title}</strong>
      <SpotlightEventLocation event={event} />
    </span>
    <ChevronRight size={20} aria-hidden="true" />
  </button>
}

export function SpotlightEventsEmbedPage() {
  const [params] = useSearchParams()
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const embedded = params.get('embedded') === '1'
  const { events, loading, error } = useEvents({ upcomingOnly: true, limit: 4 })
  const featuredEvent = events[0]
  const upcomingEvents = events.slice(1, 4)
  const communityName = 'IGDA Perú'
  const allEventsUrl = new URL('/', window.location.origin).toString()

  useEffect(() => {
    if (window.parent === window) return undefined

    const notifyParent = () => {
      const embed = document.querySelector<HTMLElement>('.spotlight-embed')
      const height = embed ? Math.ceil(embed.getBoundingClientRect().bottom + 24) : document.body.scrollHeight
      window.parent.postMessage({ type: 'igda-events-embed-height', height }, '*')
    }

    notifyParent()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(notifyParent)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [events.length, loading, error])

  return <div className={`spotlight-embed-page${embedded ? ' spotlight-embed-page--embedded' : ''}`}>
    <section className={`spotlight-embed${embedded ? ' spotlight-embed--embedded' : ''}`} aria-labelledby="spotlight-embed-title">
      {!embedded && <div className="spotlight-embed-header">
        <span className="spotlight-embed-brand"><img src="/brand/logo-igda-peru.png" alt="" width="36" height="34" /><span>Eventos {communityName}</span></span>
        <span className="spotlight-embed-tagline">Comunidad. Juegos. Oportunidades.</span>
      </div>}
      {embedded ? <div className="spotlight-embed-heading">
        <span className="spotlight-embed-kicker">Agenda</span>
        <h1 id="spotlight-embed-title">Próximos eventos</h1>
        <p>Actividades de todas las comunidades de {communityName}.</p>
      </div> : <h1 id="spotlight-embed-title" className="sr-only">Eventos de todas las comunidades de {communityName}</h1>}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && featuredEvent && <div className="spotlight-embed-grid">
        <SpotlightFeature event={featuredEvent} onOpen={() => setSelectedEvent(featuredEvent)} />
        <section className="spotlight-upcoming" aria-labelledby="spotlight-upcoming-title">
          <div className="spotlight-upcoming-heading"><h2 id="spotlight-upcoming-title">Siguientes eventos</h2></div>
          <div className="spotlight-upcoming-list">
            {upcomingEvents.map((event) => <SpotlightUpcomingItem event={event} onOpen={() => setSelectedEvent(event)} key={event.id} />)}
          </div>
        </section>
      </div>}
      {!loading && !error && featuredEvent && <a className="spotlight-all-events" href={allEventsUrl} target="_top" rel="noreferrer">Ver todos los eventos <ArrowRight size={18} aria-hidden="true" /></a>}
      {!loading && !error && !featuredEvent && <EmptyEvents />}
    </section>
    <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
  </div>
}
