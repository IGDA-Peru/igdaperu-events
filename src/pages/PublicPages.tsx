import { ArrowRight, ChevronDown, ChevronRight, Code2, Eye, ExternalLink, Gamepad2, PencilLine, Star, Users, X } from 'lucide-react'
import { CalendarDays, CheckCircle2, Clock3, Link2, MapPin, Send, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EventCard, EmptyEvents } from '../components/EventCard'
import { DemoNotice, ErrorState, LoadingState } from '../components/Feedback'
import { EventPreviewDrawer } from '../components/EventPreviewDrawer'
import { CommunityLogo } from '../components/CommunityLogo'
import { EventFiltersPopover, EventSearchField } from '../components/EventFilters'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { EventResults, EventViewSwitcher, type EventFocusRequest } from '../components/EventViews'
import type { EventViewMode } from '../components/eventViewModes'
import { filterEvents, type CommunityFilterOption, type ModalityFilter, type TimeFilter } from '../lib/eventFilters'
import { eventTypeOptions, isStandardEventType } from '../lib/eventTypes'
import { isSupabaseConfigured } from '../lib/supabase'
import { getEventCoverUrl, listCommunities, listEvents, listHomeEmbedEvents, submitEventProposal, type EventProposalSubmission, type EventQueryOptions } from '../lib/data'
import { limaNowDateTimeInput } from '../lib/eventSchedule'
import { EVENT_DESCRIPTION_MAX_LENGTH } from '../lib/eventLimits'
import { formatDateParts, formatEventLocation, isEventOngoing, isEventPast } from '../lib/format'
import type { Community, EventItem } from '../types'
import { useLocale, withLocale } from '../i18n'

const notionCommunitiesEmbedUrl = 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21'
const publicCalendarUrl = 'https://igda.pe/comunidad/calendario/'
const publicGoogleCalendarUrl = 'https://calendar.google.com/calendar/u/3?cid=Y18zOWUwMGQzZjlkNjc2YzAxNTY0MGJhM2RhYmQxNTI3YThlZTNiMGEwNjAzZTgzNjhjOTIzNjZlZDM3Zjc0YmQ1QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20'
const publicGoogleCalendarIcalUrl = 'https://calendar.google.com/calendar/ical/c_39e00d3f9d676c015640ba3dabd1527a8ee3b0a0603e8368c92366ed37f74bd5%40group.calendar.google.com/public/basic.ics'
const publicGoogleCalendarWebcalUrl = publicGoogleCalendarIcalUrl.replace('https://', 'webcal://')
const outlookCalendarUrl = 'https://outlook.live.com/calendar/0/addcalendar'
const liveEventNoticeStorageKey = 'igda-live-event-notices-v1'

function localizedPublicUrl(url: string, locale: ReturnType<typeof useLocale>['locale']) {
  if (locale === 'es') return url
  const target = new URL(url)
  if (target.hostname !== 'igda.pe') return url
  target.pathname = withLocale(target.pathname, locale)
  return target.toString()
}

function liveEventNoticeKey(event: EventItem) {
  return `${event.id}:${event.startsAt || ''}`
}

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

function ProposalConfirmationPanel() {
  return <section className="proposal-info-panel" role="status"><CheckCircle2 size={38} aria-hidden="true" /><h2>Recibimos tu propuesta</h2><span className="proposal-info-line" /><p>La revisaremos y, si hace falta, te contactaremos para completar o corregir la información.</p><div className="proposal-info-divider" /><small>La publicación depende de la revisión del equipo de IGDA Perú.</small><Link className="primary-button" to="/">Volver a la agenda</Link></section>
}

export function CalendarAccessPage() {
  const { t } = useLocale()
  const [icalCopied, setIcalCopied] = useState(false)

  const copyIcalUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicGoogleCalendarIcalUrl)
      setIcalCopied(true)
      window.setTimeout(() => setIcalCopied(false), 2400)
    } catch {
      setIcalCopied(false)
    }
  }

  return <div className="calendar-access-page">
    <section className="calendar-access-hero" aria-labelledby="calendar-access-title">
      <div>
        <span className="calendar-access-kicker">{t('calendar.kicker')}</span>
        <h1 id="calendar-access-title">{t('calendar.subscribeTitle')}</h1>
        <p>{t('calendar.subscribeDescription')}</p>
      </div>
    </section>

    <section className="calendar-platforms" aria-labelledby="calendar-platforms-title">
      <h2 className="sr-only" id="calendar-platforms-title">{t('calendar.choosePlatform')}</h2>
      <div className="calendar-platform-grid">
        <article className="calendar-platform-card calendar-platform-card--google">
          <img className="calendar-platform-art" src="/calendar-platforms/google-calendar-official.jpg" alt="" aria-hidden="true" />
          <span className="calendar-platform-badge">Google Calendar</span>
          <h3>Google Calendar</h3>
          <p>{t('calendar.addToGoogle')}</p>
          <a className="secondary-button calendar-platform-action" href={publicGoogleCalendarUrl} target="_blank" rel="noreferrer">
            {t('calendar.subscribe')} <ExternalLink size={15} aria-hidden="true" />
          </a>
        </article>
        <article className="calendar-platform-card">
          <img className="calendar-platform-art" src="/calendar-platforms/outlook-official.jpg" alt="" aria-hidden="true" />
          <span className="calendar-platform-badge">Outlook / Microsoft 365</span>
          <h3>Microsoft Outlook</h3>
          <p>{t('calendar.addToOutlook')}</p>
          <a className="secondary-button calendar-platform-action" href={outlookCalendarUrl} target="_blank" rel="noreferrer">
            {t('calendar.subscribe')} <ExternalLink size={15} aria-hidden="true" />
          </a>
        </article>
        <article className="calendar-platform-card">
          <img className="calendar-platform-art" src="/calendar-platforms/apple-calendar-official.jpg" alt="" aria-hidden="true" />
          <span className="calendar-platform-badge">iPhone / iPad / Mac</span>
          <h3>Apple Calendar</h3>
          <p>{t('calendar.addToApple')}</p>
          <a className="secondary-button calendar-platform-action" href={publicGoogleCalendarWebcalUrl} target="_blank" rel="noreferrer">
            {t('calendar.subscribe')} <ExternalLink size={15} aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>

    <aside className="calendar-access-note" aria-label={t('calendar.notOpened')}>
      <CalendarDays size={22} aria-hidden="true" />
      <div>
        <strong>{t('calendar.notOpened')}</strong>
        <p>{t('calendar.copyDescription')}</p>
        <div className="calendar-access-note-actions">
          <a className="secondary-button" href={publicGoogleCalendarIcalUrl} target="_blank" rel="noreferrer">{t('calendar.openIcal')} <ExternalLink size={15} aria-hidden="true" /></a>
          <button className="secondary-button" type="button" onClick={() => void copyIcalUrl()}>{icalCopied ? t('calendar.copied') : t('calendar.copyIcal')}</button>
        </div>
      </div>
    </aside>
  </div>
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

  if (submitted) return <div className="proposal-page"><ProposalConfirmationPanel /></div>

  return <div className="proposal-page">
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
  const { t } = useLocale()
  return (
    <aside className="communities-panel" aria-labelledby="communities-title">
      <h2 id="communities-title">{t('agenda.communityTitle')}</h2>
      <p>{t('agenda.allCommunitiesDescription')}</p>
      <div className="community-list">
        {communities.slice(0, 5).map((community, index) => (
          <Link className="community-item" to={`/comunidades/${community.slug}`} key={community.id}>
            <CommunityIcon index={index} logoPath={community.logoPath} name={community.name} brandColor={community.brandColor} />
            <strong>{community.name}</strong>
          </Link>
        ))}
      </div>
      <Link className="all-communities" to="/comunidades">{t('agenda.allCommunitiesAction')} <ChevronRight size={19} /></Link>
    </aside>
  )
}

type AgendaMode = 'editor' | 'public'

function initialAgendaModePanelOpen() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(max-width: 1100px)').matches
}

function AgendaModeToggle({ value, onChange, open, onToggle }: { value: AgendaMode; onChange: (mode: AgendaMode) => void; open: boolean; onToggle: () => void }) {
  const { t } = useLocale()
  return (
    <div className={`agenda-mode-shell ${open ? 'is-open' : ''}`}>
      <button className="agenda-mode-trigger" type="button" aria-expanded={open} aria-controls="agenda-mode-panel" onClick={onToggle}>
        <Eye size={17} aria-hidden="true" />
        <span>{t('agenda.visualization')}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <aside id="agenda-mode-panel" className="agenda-mode-toggle" aria-labelledby="agenda-mode-title">
        <div className="agenda-mode-heading">
          <span id="agenda-mode-title" className="agenda-mode-kicker">{t('agenda.visualization')}</span>
        </div>
        <div className="agenda-mode-control" role="group" aria-label="Modo de visualización">
          <button className={`agenda-mode-option ${value === 'editor' ? 'selected' : ''}`} type="button" aria-pressed={value === 'editor'} onClick={() => onChange('editor')}>
            <PencilLine size={16} aria-hidden="true" />
            <span>{t('agenda.modeEditor')}</span>
          </button>
          <button className={`agenda-mode-option ${value === 'public' ? 'selected' : ''}`} type="button" aria-pressed={value === 'public'} onClick={() => onChange('public')}>
            <Eye size={16} aria-hidden="true" />
            <span>{t('agenda.modePublic')}</span>
          </button>
        </div>
      </aside>
    </div>
  )
}

function getRecentCommunities(events: EventItem[]) {
  const nextByCommunity = new Map<string, { id: string; slug: string; name: string; logoPath?: string | null; brandColor?: string | null; nextAt: string }>()
  events.forEach((event) => {
    if (!event.startsAt || !event.communityId || isEventPast(event)) return
    const current = nextByCommunity.get(event.communityId)
    if (!current || new Date(event.startsAt) < new Date(current.nextAt)) {
      nextByCommunity.set(event.communityId, { id: event.communityId, slug: event.communitySlug, name: event.communityName, logoPath: event.communityLogoPath, brandColor: event.communityColor, nextAt: event.startsAt })
    }
  })
  return [...nextByCommunity.values()]
    .sort((first, second) => new Date(first.nextAt).getTime() - new Date(second.nextAt).getTime())
    .slice(0, 5)
}

function LiveEventNotice({ event, onDismiss, onOpenEvent }: { event: EventItem; onDismiss: () => void; onOpenEvent: () => void }) {
  const { t } = useLocale()
  const meetingUrl = event.meetingUrl && event.meetingLinkVisibility !== 'none' ? event.meetingUrl : ''
  const participationUrl = meetingUrl || event.registrationUrl || ''
  const communityHref = event.communitySlug ? `/comunidades/${encodeURIComponent(event.communitySlug)}` : ''

  return <aside className="live-event-toast" role="status" aria-live="polite" aria-labelledby="live-event-notice-title" aria-describedby="live-event-notice-description">
    <div className="live-event-notice-heading">
      <span className="live-event-notice-status"><span className="event-live-dot" aria-hidden="true" />{t('live.status')}</span>
      <button className="icon-button" type="button" onClick={onDismiss} aria-label={t('live.close')}><X size={18} /></button>
    </div>
    <h2 id="live-event-notice-title">{t('live.title')}</h2>
    <p id="live-event-notice-description"><strong>{event.title}</strong>{event.communityName ? ` · ${t('live.organizedBy', { community: event.communityName })}` : ` · ${t('live.joinActivity')}`}</p>
    <div className="live-event-notice-actions">
      {participationUrl
        ? <a className="primary-button" href={participationUrl} target="_blank" rel="noreferrer">{meetingUrl ? t('live.join') : t('live.participate')} <ArrowRight size={17} aria-hidden="true" /></a>
        : communityHref
          ? <Link className="primary-button" to={communityHref} onClick={onDismiss}>{t('live.viewCommunity')} <ArrowRight size={17} aria-hidden="true" /></Link>
          : <button className="primary-button" type="button" onClick={() => { onOpenEvent(); onDismiss() }}>{t('live.viewEvent')} <ArrowRight size={17} aria-hidden="true" /></button>}
      {participationUrl && communityHref && <Link className="live-event-community-link" to={communityHref} onClick={onDismiss}>{t('live.viewCommunity')}</Link>}
    </div>
  </aside>
}

function useLiveEventNotice(events: EventItem[]) {
  const [now, setNow] = useState(() => Date.now())
  const [liveNoticeEvent, setLiveNoticeEvent] = useState<EventItem | null>(null)
  const liveNoticeShownThisVisit = useRef(false)
  const seenLiveEventKeys = useRef<Set<string> | null>(null)
  const liveEvents = useMemo(() => events.filter((event) => isEventOngoing(event, now)), [events, now])
  const liveEventIds = useMemo(() => new Set(liveEvents.map((event) => event.id)), [liveEvents])

  useEffect(() => {
    const updateClock = () => setNow(Date.now())
    const interval = window.setInterval(updateClock, 30_000)
    window.addEventListener('focus', updateClock)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', updateClock)
    }
  }, [])

  useEffect(() => {
    if (liveNoticeShownThisVisit.current || !liveEvents.length) return
    if (!seenLiveEventKeys.current) {
      let storedKeys: unknown
      try {
        storedKeys = JSON.parse(window.localStorage.getItem(liveEventNoticeStorageKey) || '[]')
      } catch {
        storedKeys = []
      }
      seenLiveEventKeys.current = new Set(Array.isArray(storedKeys) ? storedKeys.filter((key): key is string => typeof key === 'string') : [])
    }

    const seenKeys = seenLiveEventKeys.current
    const nextNotice = liveEvents.find((event) => !seenKeys.has(liveEventNoticeKey(event)))
    if (!nextNotice) return

    liveNoticeShownThisVisit.current = true
    liveEvents.forEach((event) => seenKeys.add(liveEventNoticeKey(event)))
    try {
      window.localStorage.setItem(liveEventNoticeStorageKey, JSON.stringify([...seenKeys]))
    } catch {
      // Keep the notification unique during this page visit when storage is unavailable.
    }
    setLiveNoticeEvent(nextNotice)
  }, [liveEvents])

  useEffect(() => {
    if (liveNoticeEvent && !liveEventIds.has(liveNoticeEvent.id)) setLiveNoticeEvent(null)
  }, [liveEventIds, liveNoticeEvent])

  return { now, liveEvents, liveEventIds, liveNoticeEvent, dismissLiveNotice: () => setLiveNoticeEvent(null) }
}

export function PublicAgendaPage({ onLiveNoticeChange }: { onLiveNoticeChange?: (visible: boolean) => void } = {}) {
  const { t } = useLocale()
  const { user, configured } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [communityFilter, setCommunityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<EventViewMode>('cards')
  const [agendaMode, setAgendaMode] = useState<AgendaMode>('editor')
  const [modePanelOpen, setModePanelOpen] = useState(initialAgendaModePanelOpen)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const editorMode = Boolean(user && agendaMode === 'editor')
  const { events, loading, error } = useEvents({ network: editorMode })
  const { liveEventIds, liveNoticeEvent, dismissLiveNotice } = useLiveEventNotice(events)
  const sharedEventKey = searchParams.get('evento')

  useEffect(() => {
    onLiveNoticeChange?.(Boolean(liveNoticeEvent))
  }, [liveNoticeEvent, onLiveNoticeChange])

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
    return filterEvents(events, { search, timeFilter, modalityFilter, locationFilter })
  }, [events, locationFilter, modalityFilter, search, timeFilter])

  const communityOptions = useMemo<CommunityFilterOption[]>(() => {
    const options = new Map<string, CommunityFilterOption>()
    events.forEach((event) => {
      if (event.communityId && event.communityName) options.set(event.communityId, { value: event.communityId, label: event.communityName })
      if (!event.communityId) options.set('__independent__', { value: '__independent__', label: t('filters.independentEvents') })
    })
    return [...options.values()].sort((first, second) => first.label.localeCompare(second.label, 'es'))
  }, [events, t])

  const recentCommunities = useMemo(() => getRecentCommunities(events), [events])
  const clearFilters = () => {
    setTimeFilter('all')
    setModalityFilter('all')
    setLocationFilter('all')
    setCommunityFilter('all')
  }

  return (
    <div className="page-wrap page-wrap--events">
      {!configured && <DemoNotice />}
      <div className="content-grid">
        <section className="events-section" aria-label={t('agenda.upcomingEvents')}>
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {!loading && !error && <EventResults
            events={visibleEvents}
            liveEventIds={liveEventIds}
            viewMode={viewMode}
            showVisibility={editorMode}
            onEventOpen={setSelectedEvent}
            showViewLabel={false}
            communityFilter={communityFilter}
            toolbarCenter={<EventViewSwitcher value={viewMode} onChange={setViewMode} />}
            toolbarEnd={<><EventFiltersPopover timeFilter={timeFilter} modalityFilter={modalityFilter} locationFilter={locationFilter} communityFilter={communityFilter} communityOptions={communityOptions} onTimeChange={setTimeFilter} onModalityChange={(value) => { setModalityFilter(value); setLocationFilter('all') }} onLocationChange={setLocationFilter} onCommunityChange={setCommunityFilter} onClear={clearFilters} showTimeFilter={viewMode === 'cards'} showCommunityFilter /><EventSearchField search={search} onSearchChange={setSearch} /></>}
          />}
        </section>
        <div className="events-sidebar">
          {user && <AgendaModeToggle value={agendaMode} onChange={setAgendaMode} open={modePanelOpen} onToggle={() => setModePanelOpen((current) => !current)} />}
          <CommunityRail communities={recentCommunities} />
        </div>
      </div>
      {liveNoticeEvent && <LiveEventNotice event={liveNoticeEvent} onDismiss={dismissLiveNotice} onOpenEvent={() => setSelectedEvent(liveNoticeEvent)} />}
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
  const { t } = useLocale()
  const [params] = useSearchParams()
  const [showCalendarReminder, setShowCalendarReminder] = useState(false)
  const [liveNoticeVisible, setLiveNoticeVisible] = useState(false)
  const visitCounted = useRef(false)

  useEffect(() => {
    if (params.get('spotlight') === '1' || visitCounted.current) return
    visitCounted.current = true

    const visitStorageKey = 'igda-calendar-reminder-home-visits-v1'
    let visitCount = 0
    try {
      visitCount = Number.parseInt(window.localStorage.getItem(visitStorageKey) || '0', 10)
      if (!Number.isFinite(visitCount) || visitCount < 0) visitCount = 0
      visitCount += 1
      window.localStorage.setItem(visitStorageKey, String(visitCount))
    } catch {
      // Keep the reminder usable when browser storage is unavailable.
      visitCount = 1
    }

    if (visitCount === 1 || (visitCount - 1) % 12 === 0) setShowCalendarReminder(true)
  }, [params])

  if (params.get('spotlight') === '1') return <HomeSpotlightPreviewPage />

  return <>
    <PublicAgendaPage onLiveNoticeChange={setLiveNoticeVisible} />
    {showCalendarReminder && !liveNoticeVisible && <aside className="calendar-reminder-toast" role="status" aria-live="polite" aria-labelledby="calendar-reminder-title" aria-describedby="calendar-reminder-description">
      <div className="calendar-reminder-heading">
        <span className="calendar-reminder-icon" aria-hidden="true"><CalendarDays size={25} /></span>
        <button className="icon-button" type="button" onClick={() => setShowCalendarReminder(false)} aria-label={t('reminder.close')}><X size={18} /></button>
      </div>
      <span className="calendar-access-kicker">{t('reminder.kicker')}</span>
      <h2 id="calendar-reminder-title">{t('reminder.title')}</h2>
      <p id="calendar-reminder-description">{t('reminder.description')}</p>
      <div className="calendar-reminder-actions">
        <Link className="primary-button" to="/calendario" onClick={() => setShowCalendarReminder(false)}>{t('reminder.action')} <ArrowRight size={17} aria-hidden="true" /></Link>
        <button className="calendar-reminder-dismiss" type="button" onClick={() => setShowCalendarReminder(false)}>{t('reminder.dismiss')}</button>
      </div>
    </aside>}
  </>
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
  const { t } = useLocale()
  const [params] = useSearchParams()
  const [viewMode, setViewMode] = useState<EventViewMode>('calendar')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [communityFilter, setCommunityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [focusRequest, setFocusRequest] = useState<EventFocusRequest | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const communitySlug = params.get('community') || undefined
  const { events, loading, error } = useEvents({ communitySlug })
  const visibleEvents = useMemo(() => filterEvents(events, { search, timeFilter, modalityFilter, locationFilter, communityFilter }), [communityFilter, events, locationFilter, modalityFilter, search, timeFilter])
  const communityOptions = useMemo<CommunityFilterOption[]>(() => {
    const options = new Map<string, CommunityFilterOption>()
    events.forEach((event) => {
      if (event.communityId && event.communityName) options.set(event.communityId, { value: event.communityId, label: event.communityName })
      if (!event.communityId) options.set('__independent__', { value: '__independent__', label: t('filters.independentEvents') })
    })
    return [...options.values()].sort((first, second) => first.label.localeCompare(second.label, 'es'))
  }, [events, t])
  const clearFilters = () => {
    setTimeFilter('all')
    setModalityFilter('all')
    setLocationFilter('all')
    setCommunityFilter('all')
  }
  return <div className="embed-page"><div className="embed-header"><span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>IGDA Perú {t('nav.events')}</span></span><Link to="/" target="_blank">{t('embed.allEvents')} <ExternalLink size={14} /></Link></div>{loading && <LoadingState />}{error && <ErrorState message={error} />}{!loading && !error && <EventResults events={visibleEvents} viewMode={viewMode} showVisibility={false} onEventOpen={setSelectedEvent} showViewLabel={false} focusRequest={focusRequest} onFocusRequestChange={setFocusRequest} communityFilter={communityFilter} toolbarCenter={<EventViewSwitcher value={viewMode} onChange={setViewMode} />} toolbarEnd={<><EventFiltersPopover timeFilter={timeFilter} modalityFilter={modalityFilter} locationFilter={locationFilter} communityFilter={communityFilter} communityOptions={communityOptions} onTimeChange={setTimeFilter} onModalityChange={(value) => { setModalityFilter(value); setLocationFilter('all') }} onLocationChange={setLocationFilter} onCommunityChange={setCommunityFilter} onClear={clearFilters} showTimeFilter showCommunityFilter /><EventSearchField search={search} onSearchChange={setSearch} /></>} />}<EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" /></div>
}

export function HomeEventsEmbedPage() {
  const { locale, t } = useLocale()
  const [params] = useSearchParams()
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const communitySlug = params.get('community') || undefined
  const embedded = params.get('embedded') === '1'
  const { events, loading, error } = useHomeEmbedEvents(communitySlug)
  const { liveEventIds, liveNoticeEvent, dismissLiveNotice } = useLiveEventNotice(events)
  const communityName = events.find((event) => event.communityName)?.communityName

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
            <span className="home-events-embed-kicker">{t('embed.agenda')}</span>
            <h1 id="home-events-embed-title">{t('embed.upcomingEvents')}</h1>
            <p>{communitySlug ? t('embed.communityActivitiesOf', { community: communityName || t('agenda.community').toLowerCase() }) : t('embed.communityActivities')}</p>
          </div>
        </div>
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (events.length ? <div className="event-list">{events.map((event) => <EventCard event={event} compact showCover happeningNow={liveEventIds.has(event.id)} onOpen={() => setSelectedEvent(event)} key={event.id} />)}</div> : <EmptyEvents />)}
        <div className="home-events-embed-cta-row">
          <a className="primary-button home-events-embed-cta" href={localizedPublicUrl(publicCalendarUrl, locale)} target="_blank" rel="noreferrer">{t('embed.allEvents')} <ExternalLink size={16} aria-hidden="true" /></a>
        </div>
      </section>
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
      {liveNoticeEvent && <LiveEventNotice event={liveNoticeEvent} onDismiss={dismissLiveNotice} onOpenEvent={() => setSelectedEvent(liveNoticeEvent)} />}
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

function SpotlightNextBadge({ inline = false }: { inline?: boolean }) {
  return <span className={`spotlight-feature-badge${inline ? ' spotlight-feature-badge--inline' : ''}`} role="img" aria-label="Próximo evento" title="Próximo evento"><Star size={16} fill="currentColor" aria-hidden="true" /></span>
}

function SpotlightLiveBadge({ inline = false }: { inline?: boolean }) {
  return <span className={`spotlight-live-badge${inline ? ' spotlight-live-badge--inline' : ''}`}><span className="event-live-dot" aria-hidden="true" />En curso</span>
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

function SpotlightFeature({ event, onOpen, happeningNow = false }: { event: EventItem; onOpen: () => void; happeningNow?: boolean }) {
  const hasCover = Boolean(getEventCoverUrl(event.coverPath))
  const meetingUrl = event.meetingUrl && event.meetingLinkVisibility !== 'none' ? event.meetingUrl : ''
  const participationUrl = happeningNow ? meetingUrl || event.registrationUrl : event.registrationUrl
  let actionLabel = 'Inscribirme'
  if (happeningNow) actionLabel = meetingUrl ? 'Unirme ahora' : 'Participar ahora'
  return <article className={`spotlight-feature-card spotlight-feature-card--interactive${hasCover ? '' : ' spotlight-feature-card--no-media'}${happeningNow ? ' live-event' : ''}`} style={{ '--community-color': event.communityColor || undefined } as CSSProperties} onClick={(interaction) => {
    if ((interaction.target as HTMLElement).closest('a, button')) return
    onOpen()
  }}>
    {hasCover && <div className="spotlight-feature-media">
      <SpotlightEventMedia event={event} size="feature" />
      {happeningNow ? <SpotlightLiveBadge /> : <SpotlightNextBadge />}
    </div>}
    <div className="spotlight-feature-body">
      <SpotlightEventDate event={event} large />
      <div className="spotlight-feature-copy">
        <div className="spotlight-feature-eyebrow">
          {!hasCover && (happeningNow ? <SpotlightLiveBadge inline /> : <SpotlightNextBadge inline />)}
          <span className="spotlight-event-type">{event.type}</span>
        </div>
        <h2><button className="spotlight-feature-title" type="button" onClick={onOpen}>{event.title}</button></h2>
        <SpotlightEventLocation event={event} />
        <div className="spotlight-feature-community"><CommunityLogo path={event.communityLogoPath} name={event.communityName} color={event.communityColor} size="small" decorative /><span>Organiza {event.communityName}</span></div>
      </div>
      {participationUrl ? <a className="primary-button spotlight-feature-action spotlight-feature-action--registration" href={participationUrl} target="_blank" rel="noreferrer">{actionLabel} <ExternalLink size={16} aria-hidden="true" /></a> : <button className="spotlight-feature-action spotlight-feature-action--icon" aria-label="Ver evento" type="button" onClick={onOpen}><ChevronRight size={24} aria-hidden="true" /></button>}
    </div>
  </article>
}

function SpotlightUpcomingItem({ event, onOpen, happeningNow = false }: { event: EventItem; onOpen: () => void; happeningNow?: boolean }) {
  return <button className={`spotlight-upcoming-item${happeningNow ? ' live-event' : ''}`} type="button" onClick={onOpen} aria-label={`${happeningNow ? 'En curso: ' : ''}Ver ${event.title}`}>
    <SpotlightEventMedia event={event} size="small" showCommunityLogo />
    <SpotlightEventDate event={event} />
    <span className="spotlight-upcoming-copy">
      {happeningNow && <SpotlightLiveBadge inline />}
      <strong>{event.title}</strong>
      <SpotlightEventLocation event={event} />
    </span>
    <ChevronRight size={20} aria-hidden="true" />
  </button>
}

function SpotlightEventsEmbedContent() {
  const { locale, t } = useLocale()
  const [params] = useSearchParams()
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const embedded = params.get('embedded') === '1'
  const hideUpcoming = params.get('hideUpcoming') === '1'
  const fitContent = params.get('fit') === 'content'
  const { events, loading, error } = useEvents({ activeOrUpcoming: true, limit: 50 })
  const { now, liveEventIds, liveNoticeEvent, dismissLiveNotice } = useLiveEventNotice(events)
  const upcomingAndLiveEvents = useMemo(() => events
    .filter((event) => isEventOngoing(event, now) || !isEventPast(event))
    .sort((first, second) => {
      const firstLive = isEventOngoing(first, now)
      const secondLive = isEventOngoing(second, now)
      if (firstLive !== secondLive) return firstLive ? -1 : 1
      return new Date(first.startsAt || 0).getTime() - new Date(second.startsAt || 0).getTime()
    })
    .slice(0, 4), [events, now])
  const featuredEvent = upcomingAndLiveEvents[0]
  const upcomingEvents = upcomingAndLiveEvents.slice(1, 4)
  const showUpcoming = !hideUpcoming && upcomingEvents.length > 0
  const communityName = 'IGDA Perú'
  const allEventsUrl = localizedPublicUrl(publicCalendarUrl, locale)

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
  }, [upcomingAndLiveEvents.length, loading, error, Boolean(liveNoticeEvent)])

  return <div className={`spotlight-embed-page${embedded ? ' spotlight-embed-page--embedded' : ''}${fitContent ? ' spotlight-embed-page--fit-content' : ''}`}>
    <section className={`spotlight-embed${embedded ? ' spotlight-embed--embedded' : ''}`} aria-labelledby="spotlight-embed-title">
      {!embedded && <div className="spotlight-embed-heading">
        <span className="spotlight-embed-kicker">{t('embed.agenda')}</span>
        <h1 id="spotlight-embed-title">{t('embed.upcomingEvents')}</h1>
        <p>{t('embed.communityActivitiesOf', { community: communityName })}</p>
      </div>}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && featuredEvent && <div className={`spotlight-embed-grid${showUpcoming ? '' : ' spotlight-embed-grid--single'}`}>
        <SpotlightFeature event={featuredEvent} happeningNow={liveEventIds.has(featuredEvent.id)} onOpen={() => setSelectedEvent(featuredEvent)} />
        {showUpcoming && <section className="spotlight-upcoming" aria-labelledby="spotlight-upcoming-title">
          <div className="spotlight-upcoming-heading"><h2 id="spotlight-upcoming-title">{t('embed.nextEvents')}</h2></div>
          <div className="spotlight-upcoming-list">
            {upcomingEvents.map((event) => <SpotlightUpcomingItem event={event} happeningNow={liveEventIds.has(event.id)} onOpen={() => setSelectedEvent(event)} key={event.id} />)}
          </div>
        </section>}
      </div>}
      {!loading && !error && featuredEvent && <a className="spotlight-all-events" href={allEventsUrl} target="_blank" rel="noreferrer">{t('embed.allEvents')} <ArrowRight size={18} aria-hidden="true" /></a>}
      {!loading && !error && !featuredEvent && <EmptyEvents />}
    </section>
    <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} presentation="modal" />
    {liveNoticeEvent && <LiveEventNotice event={liveNoticeEvent} onDismiss={dismissLiveNotice} onOpenEvent={() => setSelectedEvent(liveNoticeEvent)} />}
  </div>
}

export function SpotlightEventsEmbedPage() {
  const [params] = useSearchParams()
  return params.get('embedded') === '1' ? <HomeEventsEmbedPage /> : <SpotlightEventsEmbedContent />
}
