import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Clipboard, Clock3, Globe2, ImagePlus, LockKeyhole, Mail, MapPinned, Plus, RefreshCw, Shield, UserPlus, Users, Video, X } from 'lucide-react'
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EmptyEvents, EventCard } from '../components/EventCard'
import { CommunityLogo } from '../components/CommunityLogo'
import { EventConflictNotice, type EventConflictStatus } from '../components/EventConflictNotice'
import { EventFilters } from '../components/EventFilters'
import { EventPreviewDrawer } from '../components/EventPreviewDrawer'
import { EventResults, EventViewSwitcher } from '../components/EventViews'
import { LoadingState } from '../components/Feedback'
import { GooglePlacePicker } from '../components/GooglePlacePicker'
import { ConversationSummary } from './ChatPage'
import { archiveEvent, cancelCommunityInvitation, createCommunity, createGoogleMeetLink, createInvitation, deleteEvent, getEventCoverUrl, getGoogleMeetConnection, listCommunities, listCommunityEvents, listCommunityMembers, listEventConflicts, listEventReports, listManagedEvents, resolveEventReport, revokeCommunityMember, saveEvent, startGoogleMeetConnection, syncCommunitiesFromSheet, syncEventsToGoogleCalendar, updateCommunityStatus, uploadCommunityLogo, uploadEventBanner } from '../lib/data'
import { eventFieldLabels, validateEvent, type EventField } from '../lib/eventValidation'
import { filterEvents, type TimeFilter } from '../lib/eventFilters'
import { eventSlug, formatEventDateRange, formatEventLocation, formatTimeRange, isEventPast, meetingActionLabel, slugify } from '../lib/format'
import { supabase } from '../lib/supabase'
import { emptyEventSchedule, eventScheduleFromLocalDateTimes, eventScheduleToLocalDateTimes, type EventSchedule } from '../lib/eventSchedule'
import type { Community, CommunityMember, CommunitySyncResult, EventConflict, EventInput, EventItem, EventReport, GoogleCalendarSyncResult, Membership, Role } from '../types'

function PanelEventSwitcher({ active }: { active: 'managed' | 'community' }) {
  return <div className="panel-event-switcher" role="tablist" aria-label="Eventos del panel">
    <Link className={active === 'managed' ? 'selected' : ''} role="tab" aria-selected={active === 'managed'} to="/app/eventos">Tus eventos</Link>
    <Link className={active === 'community' ? 'selected' : ''} role="tab" aria-selected={active === 'community'} to="/app/eventos/comunidad">Eventos de la comunidad</Link>
  </div>
}

function PanelTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function roleLabel(role: Role) {
  return { reader: 'Lector', community_editor: 'Editor de comunidad', community_admin: 'Administrador de comunidad', platform_admin: 'Administrador IGDA' }[role]
}

function canRemoveCommunityMember(member: CommunityMember, isPlatformAdmin: boolean) {
  return Boolean(member.membershipId || member.invitationId) && (isPlatformAdmin || member.role === 'community_editor')
}

function canDeleteEvent(event: EventItem, memberships: Pick<Membership, 'communityId' | 'role'>[], isPlatformAdmin: boolean) {
  return !isEventPast(event) && (isPlatformAdmin || memberships.some((membership) => membership.communityId === event.communityId && membership.role === 'community_admin'))
}

export function DashboardPage() {
  const { user, profile, memberships, roles, configured } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const manageable = memberships.filter((membership) => membership.role !== 'reader')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const isPlatformAdmin = roles.includes('platform_admin')
  const communityScoped = !isPlatformAdmin && manageable.length > 0
  const communityOptions = useMemo(() => memberships.filter((membership) => membership.role === 'community_admin' && membership.communityId).map((membership) => ({ id: membership.communityId, name: membership.communityName })), [memberships])
  const visibleMemberships = memberships.filter((membership) => membership.communityId)
  const canManageCommunity = isPlatformAdmin || communityOptions.length > 0
  const inviteRole = isPlatformAdmin ? 'community_admin' : 'community_editor'
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then(setEvents).finally(() => setLoading(false))
  }, [manageableIds, isPlatformAdmin])
  const canManage = manageable.length > 0 || roles.includes('platform_admin')
  const archive = async (event: EventItem) => {
    setActionError('')
    try {
      await archiveEvent(event.id)
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, status: 'archived' } : item))
      setMessage('Evento archivado.')
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : 'No pudimos archivar el evento.')
    }
  }
  const remove = async (event: EventItem) => {
    if (!window.confirm(`¿Eliminar “${event.title}”? Esta acción no se puede deshacer.`)) return
    setActionError('')
    try {
      await deleteEvent(event.id)
      setEvents((current) => current.filter((item) => item.id !== event.id))
      setMessage('Evento eliminado.')
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : 'No pudimos eliminar el evento.')
    }
  }
  return (
    <div className="dashboard-page">
      {!configured && <div className="setup-panel"><Shield size={22} /><div><strong>Supabase aún no está conectado</strong><p>El panel está listo, pero necesitas configurar las variables de entorno para activar tus datos y permisos reales.</p></div></div>}
      <div className="dashboard-grid dashboard-grid--with-chat">
        <aside className="dashboard-sidebar">
          <div className="dashboard-community-panel">
            <div className="dashboard-welcome"><span className="dashboard-kicker">{communityScoped ? 'Tu comunidad' : 'Tus comunidades'}</span><h1>{profile?.displayName ? `Hola, ${profile.displayName}` : communityScoped ? 'Tu comunidad' : 'Hola'}</h1></div>
            {visibleMemberships.length ? <div className="membership-list">{visibleMemberships.map((membership) => <div className="membership-row" key={membership.communityId}><span className="membership-avatar"><Users size={18} /></span><span><strong>{membership.communityName}</strong><small>{roleLabel(membership.role)}</small></span></div>)}</div> : <p className="muted-copy">Aún no tienes permisos de gestión. Puedes seguir consultando los eventos de la red.</p>}
            {canManageCommunity && <>
              <button className="secondary-button full dashboard-invite-button" type="button" onClick={() => setInviteOpen(true)}><UserPlus size={17} /> {isPlatformAdmin ? 'Invitar persona' : 'Invitar editor'}</button>
              <Link className="secondary-button full" to="/app/comunidad">{isPlatformAdmin ? 'Gestionar comunidades' : 'Gestionar comunidad'}</Link>
            </>}
            {roles.includes('platform_admin') && <Link className="secondary-button full" to="/app/admin">Administración IGDA</Link>}
          </div>
          <ConversationSummary canChat={canManage} />
        </aside>
        <section className="dashboard-main">
          <div className="dashboard-panel-heading"><div><PanelEventSwitcher active="managed" /><h2>Tus eventos</h2></div><div className="dashboard-panel-actions">{canManage && <Link className="primary-button" to="/app/eventos/nuevo"><Plus size={17} /> Nuevo evento</Link>}</div></div>
          {message && <p className="form-message success">{message}</p>}
          {actionError && <p className="form-message error">{actionError}</p>}
          {loading ? <LoadingState label="Cargando tus eventos" /> : events.length ? <div className="event-list">{events.slice(0, 5).map((event) => <EventCard event={event} compact onOpen={() => setSelectedEvent(event)} panelActions={{ onArchive: () => void archive(event), onDelete: () => void remove(event), canDelete: canDeleteEvent(event, memberships, isPlatformAdmin) }} key={event.id} />)}</div> : <EmptyEvents authenticated />}
        </section>
      </div>
      {user && <p className="account-caption">Sesión iniciada como {user.email}</p>}
      <InviteMemberDialog open={inviteOpen} inviteRole={inviteRole} isPlatformAdmin={isPlatformAdmin} communityOptions={communityOptions} onClose={() => setInviteOpen(false)} />
      <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}

export function ManagedEventsPage() {
  const { memberships, roles } = useAuth()
  const manageable = memberships.filter((membership) => membership.role !== 'reader')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const isPlatformAdmin = roles.includes('platform_admin')
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const load = () => { setLoading(true); void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then(setEvents).finally(() => setLoading(false)) }
  useEffect(load, [manageableIds, isPlatformAdmin])
  const archive = async (event: EventItem) => { setActionError(''); try { await archiveEvent(event.id); setMessage('Evento archivado.'); load() } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : 'No pudimos archivar el evento.') } }
  const remove = async (event: EventItem) => { if (!window.confirm(`¿Eliminar “${event.title}”? Esta acción no se puede deshacer.`)) return; setActionError(''); try { await deleteEvent(event.id); setMessage('Evento eliminado.'); load() } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : 'No pudimos eliminar el evento.') } }
  return <div className="dashboard-page"><PanelEventSwitcher active="managed" /><PanelTitle title="Tus eventos" description="Crea, publica y actualiza los eventos de tus comunidades." action={<Link className="primary-button" to="/app/eventos/nuevo"><Plus size={17} /> Nuevo evento</Link>} />{message && <p className="form-message success">{message}</p>}{actionError && <p className="form-message error">{actionError}</p>}{loading ? <LoadingState label="Cargando eventos" /> : events.length ? <div className="managed-event-list">{events.map((event) => <EventCard event={event} compact onOpen={() => setSelectedEvent(event)} panelActions={{ onArchive: () => void archive(event), onDelete: () => void remove(event), canDelete: canDeleteEvent(event, memberships, isPlatformAdmin) }} key={event.id} />)}</div> : <EmptyEvents authenticated />}<EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} /></div>
}

export function CommunityEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'calendar' | 'timeline'>('cards')
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void listCommunityEvents().then((items) => { if (active) setEvents(items) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No pudimos cargar los eventos de la comunidad.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visibleEvents = useMemo(() => filterEvents(events, { search, timeFilter, locationFilter }), [events, locationFilter, search, timeFilter])
  return <div className="dashboard-page community-events-page">
    <PanelEventSwitcher active="community" />
    <div className="panel-title"><div><h1>Eventos de la comunidad</h1><p>Consulta las actividades publicadas por las comunidades de la red.</p></div></div>
    <div className="community-events-toolbar"><EventFilters timeFilter={timeFilter} locationFilter={locationFilter} search={search} onTimeChange={setTimeFilter} onLocationChange={setLocationFilter} onSearchChange={setSearch} /><EventViewSwitcher value={viewMode} onChange={setViewMode} /></div>
    {loading ? <LoadingState label="Cargando eventos de la comunidad" /> : error ? <p className="form-message error">{error}</p> : <EventResults events={visibleEvents} viewMode={viewMode} showVisibility onEventOpen={setSelectedEvent} />}
    {selectedEvent && <EventPreviewDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
  </div>
}

const emptyEvent: EventInput = { communityId: '', title: '', slug: '', description: '', type: 'CHARLA', startsAt: '', endsAt: '', isAllDay: false, locationType: 'venue', venueName: '', address: '', mapUrl: '', placeId: '', formattedAddress: '', latitude: null, longitude: null, meetingUrl: '', meetingProvider: 'google_meet', coverPath: null, visibility: 'public', status: 'draft' }

type EditorSectionId = 'information' | 'datetime' | 'location' | 'publication'

const editorSections = [
  { id: 'information', number: '01', label: 'Información principal' },
  { id: 'datetime', number: '02', label: 'Fecha y hora' },
  { id: 'location', number: '03', label: 'Ubicación y Acceso' },
  { id: 'publication', number: '04', label: 'Publicación' },
] as const satisfies Array<{ id: EditorSectionId; number: string; label: string }>

function toLimaIso(value: string) {
  if (!value) return ''
  const date = new Date(`${value}:00-05:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function eventPayload(input: EventInput, communitySlug?: string): EventInput {
  return { ...input, slug: input.slug || eventSlug(input.title, communitySlug) || `borrador-${Date.now()}`, startsAt: toLimaIso(input.startsAt), endsAt: toLimaIso(input.endsAt) }
}

export function EventEditorPage() {
  const { eventId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { memberships, roles } = useAuth()
  const manageable = memberships.filter((membership) => membership.role !== 'reader')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const isPlatformAdmin = roles.includes('platform_admin')
  const scopedCommunity = manageable[0]
  const scopedCommunityId = scopedCommunity?.communityId || ''
  const scopedCommunityName = scopedCommunity?.communityName || ''
  const scopedCommunitySlug = scopedCommunity?.communitySlug || ''
  const [availableCommunities, setAvailableCommunities] = useState<Community[]>([])
  const [managedEvents, setManagedEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<EventInput>(emptyEvent)
  const [schedule, setSchedule] = useState<EventSchedule>(emptyEventSchedule)
  const [loading, setLoading] = useState(Boolean(eventId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EventField, string>>>({})
  const [publicationOpen, setPublicationOpen] = useState(false)
  const [publicationVisibility, setPublicationVisibility] = useState<EventInput['visibility']>('public')
  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<EditorSectionId>('information')
  const [conflictState, setConflictState] = useState<{ status: EventConflictStatus; conflicts: EventConflict[]; hasMore: boolean; error?: string }>({ status: 'idle', conflicts: [], hasMore: false })
  const [googleMeetConnection, setGoogleMeetConnection] = useState<{ status: 'idle' | 'loading' | 'connected' | 'disconnected' | 'error'; email: string | null; error?: string }>({ status: 'idle', email: null })
  const [googleMeetAction, setGoogleMeetAction] = useState<'connecting' | 'creating' | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [bannerError, setBannerError] = useState('')
  const [savedEventId, setSavedEventId] = useState<string | undefined>(eventId)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const intentionalNavigationRef = useRef(false)
  const currentEvent = managedEvents.find((event) => event.id === eventId)
  const conflictStart = toLimaIso(form.startsAt)
  const conflictEnd = toLimaIso(form.endsAt)
  const scheduleIsComplete = Boolean(conflictStart && conflictEnd && new Date(conflictEnd).getTime() > new Date(conflictStart).getTime())

  useEffect(() => {
    if (isPlatformAdmin) {
      void listCommunities(true).then(setAvailableCommunities)
      return
    }
    setAvailableCommunities(scopedCommunityId ? [{ id: scopedCommunityId, slug: scopedCommunitySlug, name: scopedCommunityName, description: '', status: 'approved' }] : [])
  }, [isPlatformAdmin, scopedCommunityId, scopedCommunityName, scopedCommunitySlug])
  useEffect(() => { if (!eventId) return; setSavedEventId(eventId); if (!manageable.length && !isPlatformAdmin) { setLoading(false); return } void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then((items) => { setManagedEvents(items); const item = items.find((event) => event.id === eventId); if (item) { const nextSchedule = { ...eventScheduleFromLocalDateTimes(item.startsAt, item.endsAt, item.isAllDay), isAllDay: false }; const localTimes = eventScheduleToLocalDateTimes(nextSchedule); setSchedule(nextSchedule); setForm({ communityId: item.communityId, title: item.title, slug: item.slug, description: item.description || '', type: item.type, startsAt: localTimes.startsAt, endsAt: localTimes.endsAt, isAllDay: false, locationType: item.locationType, venueName: item.venueName || '', address: item.address || '', mapUrl: item.mapUrl || '', placeId: item.placeId || '', formattedAddress: item.formattedAddress || '', latitude: item.latitude ?? null, longitude: item.longitude ?? null, meetingUrl: item.meetingUrl || '', meetingProvider: item.meetingProvider === 'google_meet' ? 'google_meet' : 'other', coverPath: item.coverPath || null, visibility: item.visibility, status: item.status }); setBannerPreview(getEventCoverUrl(item.coverPath) || ''); setDirty(false) } }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar el evento.')).finally(() => setLoading(false)) }, [eventId, manageableIds, isPlatformAdmin])
  useEffect(() => { if (!eventId && !form.communityId && availableCommunities[0]) setForm((current) => ({ ...current, communityId: availableCommunities[0].id })) }, [eventId, form.communityId, availableCommunities])
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const result = params.get('google_meet')
    if (!result) return
    if (params.get('google_meet_popup') === '1' && window.opener) {
      window.opener.postMessage({ source: 'igdaperu-google-meet', result, communityId: params.get('community_id') }, window.location.origin)
      window.close()
      return
    }
    if (result === 'connected') setGoogleMeetConnection((current) => ({ ...current, status: 'connected', error: undefined }))
    if (result === 'denied') setGoogleMeetConnection((current) => ({ ...current, status: 'disconnected', error: 'No se autorizó la cuenta de Google Meet.' }))
    if (result === 'error') setGoogleMeetConnection((current) => ({ ...current, status: 'error', error: 'No pudimos completar la conexión con Google Meet.' }))
    navigate(location.pathname, { replace: true })
  }, [location.pathname, location.search, navigate])
  useEffect(() => {
    const handleGoogleMeetMessage = (event: MessageEvent<{ source?: string; result?: string; communityId?: string | null }>) => {
      if (event.origin !== window.location.origin || event.data?.source !== 'igdaperu-google-meet' || event.data.communityId !== form.communityId) return
      setGoogleMeetAction(null)
      if (event.data.result === 'connected') setGoogleMeetConnection((current) => ({ ...current, status: 'connected', error: undefined }))
      else if (event.data.result === 'denied') setGoogleMeetConnection((current) => ({ ...current, status: 'disconnected', error: 'No se autorizó la cuenta de Google Meet.' }))
      else setGoogleMeetConnection((current) => ({ ...current, status: 'error', error: 'No pudimos completar la conexión con Google Meet.' }))
    }
    window.addEventListener('message', handleGoogleMeetMessage)
    return () => window.removeEventListener('message', handleGoogleMeetMessage)
  }, [form.communityId])
  useEffect(() => {
    if (!form.communityId || form.meetingProvider !== 'google_meet') {
      setGoogleMeetConnection({ status: 'idle', email: null })
      return
    }
    let active = true
    setGoogleMeetConnection({ status: 'loading', email: null })
    void getGoogleMeetConnection(form.communityId).then((result) => {
      if (active) setGoogleMeetConnection({ status: result.connected ? 'connected' : 'disconnected', email: result.email })
    }).catch((reason: unknown) => {
      if (active) setGoogleMeetConnection({ status: 'error', email: null, error: reason instanceof Error ? reason.message : 'No pudimos consultar la conexión de Google Meet.' })
    })
    return () => { active = false }
  }, [form.communityId, form.meetingProvider])
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { if (intentionalNavigationRef.current) return; event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  useEffect(() => () => { if (bannerPreview.startsWith('blob:')) URL.revokeObjectURL(bannerPreview) }, [bannerPreview])
  useEffect(() => {
    let active = true
    if (!scheduleIsComplete) {
      setConflictState({ status: 'idle', conflicts: [], hasMore: false })
      return () => { active = false }
    }
    setConflictState({ status: 'loading', conflicts: [], hasMore: false })
    void listEventConflicts(conflictStart, conflictEnd, eventId).then((result) => {
      if (active) setConflictState({ status: 'ready', ...result })
    }).catch((reason: unknown) => {
      if (active) setConflictState({ status: 'error', conflicts: [], hasMore: false, error: reason instanceof Error ? reason.message : 'El servicio no está disponible en este momento.' })
    })
    return () => { active = false }
  }, [conflictEnd, conflictStart, eventId, scheduleIsComplete])

  const update = <K extends keyof EventInput>(key: K, value: EventInput[K]) => { setDirty(true); setForm((current) => ({ ...current, [key]: value })); if (fieldErrors[key as EventField]) setFieldErrors((current) => ({ ...current, [key as EventField]: undefined })) }
  const updateSchedule = (changes: Partial<EventSchedule>) => {
    const nextSchedule = { ...schedule, ...changes, isAllDay: false }
    if (nextSchedule.mode === 'single') nextSchedule.endDate = nextSchedule.startDate
    else if (!nextSchedule.endDate && nextSchedule.startDate) nextSchedule.endDate = nextSchedule.startDate
    const localTimes = eventScheduleToLocalDateTimes(nextSchedule)
    setDirty(true)
    setSchedule(nextSchedule)
    setForm((current) => ({ ...current, startsAt: localTimes.startsAt, endsAt: localTimes.endsAt, isAllDay: false }))
    setFieldErrors((current) => ({ ...current, startsAt: undefined, endsAt: undefined }))
  }
  const updateLocation = (selection: { placeId: string; formattedAddress: string; venueName: string; address: string; latitude: number; longitude: number; mapUrl: string }) => {
    setDirty(true)
    setFieldErrors((current) => ({ ...current, location: undefined, mapUrl: undefined }))
    setForm((current) => ({ ...current, ...selection }))
  }
  const updateManualAddress = (address: string) => {
    setDirty(true)
    setFieldErrors((current) => ({ ...current, location: undefined, mapUrl: undefined }))
    setForm((current) => ({ ...current, address, formattedAddress: address, placeId: '', latitude: null, longitude: null, mapUrl: '' }))
  }
  const setBannerPreviewUrl = (url: string) => {
    setBannerPreview((current) => {
      if (current.startsWith('blob:')) URL.revokeObjectURL(current)
      return url
    })
  }
  const handleBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setBannerError('El banner debe estar en formato JPG, PNG o WebP.'); return }
    if (file.size > 8 * 1024 * 1024) { setBannerError('El banner no puede superar los 8 MB.'); return }
    setBannerError('')
    setCoverFile(file)
    setBannerPreviewUrl(URL.createObjectURL(file))
    setDirty(true)
  }
  const removeBanner = () => {
    setBannerError('')
    setCoverFile(null)
    setBannerPreviewUrl('')
    update('coverPath', null)
  }
  const connectGoogleMeet = async () => {
    const popup = window.open('', 'google-meet-connect', 'popup,width=520,height=720,resizable=yes,scrollbars=yes')
    if (!popup) {
      setGoogleMeetConnection((current) => ({ ...current, status: 'error', error: 'El navegador bloqueó la ventana emergente. Permite pop-ups para conectar Google Meet.' }))
      return
    }
    setGoogleMeetAction('connecting')
    setGoogleMeetConnection((current) => ({ ...current, error: undefined }))
    try {
      const authorizationUrl = await startGoogleMeetConnection(form.communityId, `${location.pathname}?google_meet_popup=1`)
      popup.location.href = authorizationUrl
    } catch (reason: unknown) {
      popup.close()
      setGoogleMeetAction(null)
      setGoogleMeetConnection((current) => ({ ...current, status: 'error', error: reason instanceof Error ? reason.message : 'No pudimos iniciar la conexión con Google Meet.' }))
    }
  }
  const generateGoogleMeet = async () => {
    if (!eventId) {
      setError('Guarda primero el borrador para generar el enlace de Google Meet.')
      return
    }
    setGoogleMeetAction('creating')
    setError('')
    try {
      const result = await createGoogleMeetLink(eventId)
      update('meetingUrl', result.meetingUrl)
      setGoogleMeetConnection((current) => ({ ...current, status: 'connected', email: result.googleEmail, error: undefined }))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos crear el enlace de Google Meet.')
    } finally {
      setGoogleMeetAction(null)
    }
  }
  const needsMeetingLink = form.locationType !== 'venue'
  const needsPhysicalLocation = form.locationType !== 'online'
  const hasPast = currentEvent ? isEventPast(currentEvent) : false
  const deleteAllowed = currentEvent ? canDeleteEvent(currentEvent, memberships, isPlatformAdmin) : false
  const publicPublishValidation = validateEvent({ ...form, visibility: 'public' }, 'publish')
  const networkPublishValidation = validateEvent({ ...form, visibility: 'network' }, 'publish')
  const publishValidation = validateEvent({ ...form, visibility: publicationOpen ? publicationVisibility : form.visibility }, 'publish')
  const draftValidation = validateEvent(form, 'draft')
  const publishReady = publishValidation.valid
  const publishMissingLabels = publishValidation.missing.map((field) => eventFieldLabels[field])
  const draftMissingLabels = draftValidation.missing.map((field) => eventFieldLabels[field])
  const publicMissingLabels = publicPublishValidation.missing.map((field) => eventFieldLabels[field])
  const networkMissingLabels = networkPublishValidation.missing.map((field) => eventFieldLabels[field])
  const minimumReady = draftValidation.valid
  const summaryMilestoneMissing = !minimumReady ? draftMissingLabels : form.visibility === 'network' ? networkMissingLabels : publicMissingLabels
  const summaryMilestoneReady = summaryMilestoneMissing.length === 0
  const summaryMilestoneLabel = !minimumReady ? 'Borrador / Red privada' : form.visibility === 'network' ? 'Solo la red' : 'Para publicar'
  const summaryProgressPercent = summaryMilestoneReady ? 100 : Math.max(8, 100 - summaryMilestoneMissing.length * 20)
  const statusLabel = currentEvent ? (hasPast ? 'Ya pasó' : currentEvent.status === 'published' ? 'Publicado' : currentEvent.status === 'draft' ? 'Borrador' : 'Archivado') : 'Borrador nuevo'
  const sectionCompletion: Record<EditorSectionId, boolean> = {
    information: Boolean(form.communityId && form.title.trim().length >= 3),
    datetime: scheduleIsComplete,
    location: Boolean((form.locationType === 'online' || form.venueName.trim() || form.address.trim() || form.latitude !== null) && (form.locationType === 'venue' || form.meetingUrl.trim())),
    publication: publishReady,
  }
  const activeSectionIndex = editorSections.findIndex((section) => section.id === activeSection)
  const previousSection = activeSectionIndex > 0 ? editorSections[activeSectionIndex - 1] : undefined
  const nextSection = activeSectionIndex < editorSections.length - 1 ? editorSections[activeSectionIndex + 1] : undefined

  const persist = async (status: EventInput['status'], visibility = form.visibility) => {
    const validationInput = { ...form, visibility }
    const validation = validateEvent(validationInput, status === 'draft' ? 'draft' : 'publish')
    setFieldErrors(validation.errors)
    if (!validation.valid) {
      const firstMissing = validation.missing[0]
      if (firstMissing === 'communityId' || firstMissing === 'title' || firstMissing === 'description') setActiveSection('information')
      else if (firstMissing === 'startsAt' || firstMissing === 'endsAt') setActiveSection('datetime')
      else if (firstMissing === 'location' || firstMissing === 'meetingUrl' || firstMissing === 'mapUrl') setActiveSection('location')
      setError(status === 'draft' ? 'Para guardar el borrador, selecciona una comunidad, escribe un título y define la fecha.' : visibility === 'network' ? 'Para publicar solo en la red, escribe un título y define la fecha.' : 'Completa los campos pendientes antes de publicar.')
      return false
    }
    setSaving(true); setError('')
    const communitySlug = availableCommunities.find((community) => community.id === form.communityId)?.slug
    try {
      const savedEvent = await saveEvent(eventPayload({ ...validationInput, status }, communitySlug), savedEventId)
      setSavedEventId(savedEvent.id)
      if (coverFile) {
        try {
          const coverPath = await uploadEventBanner(savedEvent.id, coverFile, form.coverPath)
          setForm((current) => ({ ...current, coverPath }))
          setCoverFile(null)
          setBannerPreviewUrl(getEventCoverUrl(coverPath) || '')
        } catch (reason: unknown) {
          setError(`El evento se guardó, pero no pudimos subir el banner. ${reason instanceof Error ? reason.message : 'Inténtalo de nuevo.'}`)
          return false
        }
      }
      intentionalNavigationRef.current = true
      setDirty(false)
      navigate('/app/eventos')
      return true
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el evento.'); return false } finally { setSaving(false) }
  }

  const save = async (event: FormEvent) => { event.preventDefault(); await persist(form.status === 'published' || form.status === 'archived' ? form.status : 'draft') }
  const requestPublish = () => { setError(''); setFieldErrors(publishValidation.errors); setPublicationVisibility(form.visibility); setPublicationOpen(true) }
  const confirmPublish = async () => { const published = await persist('published', publicationVisibility); if (published) setPublicationOpen(false) }
  const remove = async () => {
    if (!currentEvent || !deleteAllowed || !window.confirm(`¿Eliminar “${currentEvent.title}”? Esta acción no se puede deshacer.`)) return
    setSaving(true); setError('')
    try { await deleteEvent(currentEvent.id); navigate('/app/eventos') } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos eliminar el evento.') } finally { setSaving(false) }
  }

  const confirmLeave = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!dirty || intentionalNavigationRef.current) return
    if (!eventId) { event.preventDefault(); setLeaveOpen(true); return }
    if (!window.confirm('Tienes cambios sin guardar. ¿Quieres salir del editor?')) event.preventDefault()
  }
  const discardAndLeave = () => { intentionalNavigationRef.current = true; setLeaveOpen(false); setDirty(false); navigate('/app/eventos') }

  if (loading) return <LoadingState label="Cargando editor" />
  return (
    <div className="dashboard-page event-editor-page">
      <div className="editor-progress" role="tablist" aria-label="Secciones del evento">
        {editorSections.map((section) => <EditorProgressStep key={section.id} {...section} active={activeSection === section.id} complete={sectionCompletion[section.id]} onClick={() => setActiveSection(section.id)} />)}
      </div>
      <div className="event-editor-layout">
        <form className="event-editor-card" onSubmit={(event) => void save(event)}>
          {activeSection === 'information' && <section className="editor-section" id="editor-information" role="tabpanel" aria-labelledby="editor-tab-information" tabIndex={-1}>
            <div className={`form-grid ${isPlatformAdmin ? '' : 'form-grid--single'}`}>
              {isPlatformAdmin && (availableCommunities.length === 1 ? <div className="editor-field"><FieldLabel required>Comunidad</FieldLabel><div className="editor-static-value" aria-label={`Comunidad: ${availableCommunities[0].name}`}>{availableCommunities[0].name}</div><FieldError id="event-community-error" message={fieldErrors.communityId} /></div> : <label className="editor-field"><FieldLabel required>Comunidad</FieldLabel><select aria-invalid={Boolean(fieldErrors.communityId)} aria-describedby={fieldErrors.communityId ? 'event-community-error' : undefined} value={form.communityId} onChange={(event) => update('communityId', event.target.value)}><option value="">Selecciona una comunidad</option>{availableCommunities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select><FieldError id="event-community-error" message={fieldErrors.communityId} /></label>)}
              <label className="editor-field"><FieldLabel required>Título del evento</FieldLabel><input aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'event-title-error' : undefined} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej. Meetup de desarrollo indie" /><FieldError id="event-title-error" message={fieldErrors.title} /></label>
            </div>
            <div className="form-grid">
              <label className="editor-field"><FieldLabel required={false}>Tipo de actividad</FieldLabel><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>CHARLA</option><option>TALLER</option><option>MEETUP</option><option>GAME JAM</option><option>CONFERENCIA</option></select></label>
              <div className="field-spacer" aria-hidden="true" />
            </div>
            <div className="event-banner-field">
              <div className="event-banner-heading"><div><strong>Banner del evento</strong><p>Se mostrará recortado en formato horizontal 16:9.</p></div></div>
              {bannerPreview ? <div className="event-banner-preview"><img src={bannerPreview} alt="Vista previa del banner del evento" /><div className="event-banner-actions"><label className="secondary-button event-banner-action"><ImagePlus size={16} aria-hidden="true" /> Cambiar banner<input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerChange} /></label><button className="secondary-button event-banner-action" type="button" onClick={removeBanner}><X size={16} aria-hidden="true" /> Quitar banner</button></div></div> : <label className="event-banner-dropzone"><ImagePlus size={22} aria-hidden="true" /><span>Subir banner</span><small>JPG, PNG o WebP · recomendado 1600 × 900 px</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerChange} /></label>}
              {bannerError && <p className="form-message error" role="alert">{bannerError}</p>}
            </div>
              <label className="editor-field"><FieldLabel required>Descripción</FieldLabel><textarea aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? 'event-description-error' : undefined} rows={5} maxLength={5000} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Cuenta qué aprenderán o encontrarán las personas asistentes." /><div className="field-meta"><span aria-hidden="true" /><small className="field-count">{form.description.length}/5000</small></div><FieldError id="event-description-error" message={fieldErrors.description} /></label>
          </section>}

          {activeSection === 'datetime' && <section className="editor-section" id="editor-datetime" role="tabpanel" aria-labelledby="editor-tab-datetime" tabIndex={-1}>
            <fieldset className="editor-choice-group schedule-mode-group"><legend><FieldLabel required>Duración del evento</FieldLabel></legend><div className="choice-grid choice-grid-two"><ChoiceCard name="event-date-mode" value="single" checked={schedule.mode === 'single'} onChange={() => updateSchedule({ mode: 'single' })} icon={<CalendarDays size={19} aria-hidden="true" />} label="Un día" description="Una fecha con hora de inicio y fin" /><ChoiceCard name="event-date-mode" value="range" checked={schedule.mode === 'range'} onChange={() => updateSchedule({ mode: 'range' })} icon={<CalendarDays size={19} aria-hidden="true" />} label="Varias fechas" description="Un rango continuo de días" /></div></fieldset>
            <div className="form-grid schedule-dates">
              <label className="editor-field"><FieldLabel required>{schedule.mode === 'single' ? 'Fecha del evento' : 'Fecha de inicio'}</FieldLabel><input type="date" aria-invalid={Boolean(fieldErrors.startsAt)} aria-describedby={fieldErrors.startsAt ? 'event-start-error event-start-help' : 'event-start-help'} value={schedule.startDate} onChange={(event) => updateSchedule({ startDate: event.target.value })} /><small className="field-help" id="event-start-help">Formato: dd/mm/aaaa</small><FieldError id="event-start-error" message={fieldErrors.startsAt} /></label>
              {schedule.mode === 'range' && <label className="editor-field"><FieldLabel required>Fecha de fin</FieldLabel><input type="date" aria-invalid={Boolean(fieldErrors.endsAt)} aria-describedby={fieldErrors.endsAt ? 'event-end-error event-end-help' : 'event-end-help'} value={schedule.endDate} min={schedule.startDate || undefined} onChange={(event) => updateSchedule({ endDate: event.target.value })} /><small className="field-help" id="event-end-help">Incluye este día en el evento.</small><FieldError id="event-end-error" message={fieldErrors.endsAt} /></label>}
            </div>
            <div className="form-grid schedule-times"><label className="editor-field"><FieldLabel required>Hora de inicio</FieldLabel><input type="time" aria-invalid={Boolean(fieldErrors.startsAt)} aria-describedby={fieldErrors.startsAt ? 'event-start-error-time' : undefined} value={schedule.startTime} onChange={(event) => updateSchedule({ startTime: event.target.value })} /><FieldError id="event-start-error-time" message={fieldErrors.startsAt} /></label><label className="editor-field"><FieldLabel required>Hora de fin</FieldLabel><input type="time" aria-invalid={Boolean(fieldErrors.endsAt)} aria-describedby={fieldErrors.endsAt ? 'event-end-error-time' : undefined} value={schedule.endTime} onChange={(event) => updateSchedule({ endTime: event.target.value })} /><FieldError id="event-end-error-time" message={fieldErrors.endsAt} /></label></div>
            <p className="editor-inline-note"><Clock3 size={16} aria-hidden="true" /> Hora de Lima · America/Lima</p>
            <EventConflictNotice status={conflictState.status} conflicts={conflictState.conflicts} hasMore={conflictState.hasMore} error={conflictState.error} />
          </section>}

          {activeSection === 'location' && <section className="editor-section" id="editor-location" role="tabpanel" aria-labelledby="editor-tab-location" tabIndex={-1}>
            <fieldset className="editor-choice-group"><legend><FieldLabel required>Modalidad</FieldLabel></legend><div className="choice-grid choice-grid-three">{(['venue', 'online', 'hybrid'] as const).map((locationType) => <ChoiceCard key={locationType} name="locationType" value={locationType} checked={form.locationType === locationType} onChange={() => update('locationType', locationType)} icon={locationType === 'venue' ? <MapPinIcon /> : locationType === 'online' ? <Video size={19} aria-hidden="true" /> : <><MapPinIcon /><Video size={17} aria-hidden="true" /></>} label={locationType === 'venue' ? 'Presencial' : locationType === 'online' ? 'Online' : 'Híbrido'} description={locationType === 'venue' ? 'En un lugar físico' : locationType === 'online' ? 'Solo por videollamada' : 'Lugar y videollamada'} />)}</div></fieldset>
            {needsPhysicalLocation && <div className="location-editor-block">
              <GooglePlacePicker address={form.address} latitude={form.latitude} longitude={form.longitude} venueName={form.venueName} onChange={updateLocation} onManualAddressChange={updateManualAddress} />
              <FieldError id="event-location-error" message={fieldErrors.location} />
            </div>}
            {needsMeetingLink && <div className="access-editor-block">
              <label className="editor-field meeting-provider-field"><FieldLabel required={needsMeetingLink}>Plataforma</FieldLabel><select value={form.meetingProvider === 'google_meet' ? 'google_meet' : 'other'} onChange={(event) => update('meetingProvider', event.target.value as EventInput['meetingProvider'])}><option value="google_meet">Google Meet · Generar enlace</option><option value="other">Otra plataforma · Pegar enlace manual</option></select></label>
              {form.meetingProvider === 'google_meet' ? <div className="meeting-connection-panel" aria-label="Enlace para unirse" aria-live="polite"><div><strong>Google Meet</strong><small>{googleMeetConnection.status === 'loading' ? 'Verificando la cuenta conectada…' : googleMeetConnection.status === 'connected' ? `Cuenta conectada: ${googleMeetConnection.email || 'Google'}` : googleMeetConnection.error || 'Conecta una cuenta de Google para crear el enlace.'}</small></div><div className="meeting-connection-actions">{googleMeetConnection.status === 'connected' ? <button className="secondary-button" type="button" disabled={googleMeetAction !== null} onClick={() => void generateGoogleMeet()}>{googleMeetAction === 'creating' ? 'Creando enlace…' : form.meetingUrl ? 'Regenerar enlace' : 'Generar enlace'}</button> : <button className="secondary-button" type="button" disabled={googleMeetAction !== null || googleMeetConnection.status === 'loading'} onClick={() => void connectGoogleMeet()}>{googleMeetAction === 'connecting' ? 'Conectando…' : 'Conectar Google Meet'}</button>}</div>{!eventId && googleMeetConnection.status === 'connected' && <small className="field-help">Guarda el borrador y vuelve a abrirlo para generar el enlace.</small>}{form.meetingUrl && <a className="meeting-link-preview" href={form.meetingUrl} target="_blank" rel="noreferrer">{form.meetingUrl}</a>}{googleMeetConnection.status === 'error' && <FieldError id="event-meeting-error" message={googleMeetConnection.error} />}</div> : <label className="editor-field"><FieldLabel required={needsMeetingLink}>Enlace para unirse</FieldLabel><input type="url" aria-invalid={Boolean(fieldErrors.meetingUrl)} aria-describedby="event-meeting-help event-meeting-error" value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="https://…" /><div className="field-meta"><small className="field-help" id="event-meeting-help">{needsMeetingLink ? 'Es obligatorio para eventos online e híbridos.' : 'No es necesario para eventos presenciales.'}</small></div><FieldError id="event-meeting-error" message={fieldErrors.meetingUrl} /></label>}
             </div>}
          </section>}

          {activeSection === 'publication' && <section className="editor-section" id="editor-publication" role="tabpanel" aria-labelledby="editor-tab-publication" tabIndex={-1}>
            <fieldset className="editor-choice-group"><legend><FieldLabel required>Visibilidad</FieldLabel></legend><div className="choice-grid choice-grid-two"><ChoiceCard name="visibility" value="public" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} icon={<Globe2 size={19} aria-hidden="true" />} label="Público" description="Cualquier visitante, agenda y embed" /><ChoiceCard name="visibility" value="network" checked={form.visibility === 'network'} onChange={() => update('visibility', 'network')} icon={<LockKeyhole size={19} aria-hidden="true" />} label="Solo la red" description="Personas con una cuenta activa" /></div></fieldset>
            <p className="editor-inline-note"><CircleAlert size={16} aria-hidden="true" /> La visibilidad se confirma justo antes de publicar.</p>
          </section>}

          <FormError message={error} />
          <div className="editor-actions">
            <div className="editor-actions-left"><Link className="secondary-button" to="/app/eventos" onClick={confirmLeave}>Cancelar</Link>{deleteAllowed && <button className="danger-button" type="button" disabled={saving} onClick={() => void remove()}>Eliminar evento</button>}</div>
            <div className="editor-actions-primary">
              <button className="primary-button" disabled={saving || !draftValidation.valid}>{saving ? 'Guardando…' : form.status === 'published' ? 'Guardar cambios' : 'Guardar borrador'}</button>
              <div className="editor-navigation">
                {previousSection && <button className="secondary-button section-navigation-button" type="button" onClick={() => setActiveSection(previousSection.id)}><ChevronLeft size={17} /> Sección anterior</button>}
                {nextSection && <button className="primary-button section-navigation-button" type="button" onClick={() => setActiveSection(nextSection.id)}>Siguiente <ChevronRight size={17} /></button>}
                {activeSection === 'publication' && form.status !== 'published' && !hasPast && <button className="secondary-button publish-action" type="button" disabled={saving} onClick={requestPublish}>Revisar y publicar <ChevronRight size={17} /></button>}
              </div>
            </div>
          </div>
        </form>
        <div className={`editor-summary-shell ${summaryOpen ? 'is-open' : ''}`}>
          <button className="editor-summary-toggle" type="button" aria-expanded={summaryOpen} aria-controls="event-editor-summary" onClick={() => setSummaryOpen((current) => !current)}>
            <Clipboard size={17} aria-hidden="true" /> {summaryOpen ? 'Ocultar resumen' : 'Resumen'}
          </button>
          <aside className="editor-summary" id="event-editor-summary" aria-label="Resumen del evento">
            <div className="editor-summary-card">
              <div className="summary-card-heading"><span className={`status-label ${currentEvent?.status || 'draft'}`}>{statusLabel}</span>{dirty && <span className="unsaved-label">Cambios sin guardar</span>}</div>
               {bannerPreview && <img className="summary-cover" src={bannerPreview} alt={form.title.trim() ? `Banner de ${form.title.trim()}` : 'Vista previa del banner'} />}
               <h2>{form.title.trim() || 'Tu evento aparecerá aquí'}</h2>
               <p>{form.description.trim() || 'Completa la información para preparar una publicación clara.'}</p>
               <div className="summary-divider" />
               <div className="summary-schedule"><CalendarDays size={17} aria-hidden="true" /><span><strong>{formatEventDateRange(conflictStart, conflictEnd, form.isAllDay)}</strong><small>{formatTimeRange(conflictStart, conflictEnd, form.isAllDay)} · Hora de Lima</small></span></div>
               <div className="summary-location-access">
                 <div><MapPinned size={17} aria-hidden="true" /><span><strong>Ubicación</strong><small>{formatEventLocation(form)}</small></span></div>
                 <div><Video size={17} aria-hidden="true" /><span><strong>Acceso</strong><small>{form.locationType === 'venue' ? 'Presencial' : form.meetingUrl.trim() ? meetingActionLabel(form.meetingProvider) : 'Enlace por agregar'}</small></span></div>
               </div>
               <div className="summary-progress"><div className="summary-progress-top"><span>Listo para publicar</span><strong>{summaryProgressPercent}%</strong></div><div className="summary-progress-track"><span style={{ width: `${summaryProgressPercent}%` }} /></div></div>
               <div className={`summary-missing ${summaryMilestoneReady ? 'summary-missing-ready' : ''}`}><strong>{summaryMilestoneLabel}{summaryMilestoneReady ? ' listo' : ''}</strong>{summaryMilestoneReady ? <small>{form.visibility === 'network' ? 'Ya puedes publicar este evento solo para la red.' : 'Completa la revisión para publicar este evento.'}</small> : <><span className="summary-missing-caption">Falta:</span><ul>{summaryMilestoneMissing.slice(0, 4).map((label) => <li key={label}>{label}</li>)}</ul></>}{summaryMilestoneMissing.length > 4 && <small>+{summaryMilestoneMissing.length - 4} campos más</small>}</div>
              <div className="summary-visibility"><span>{form.visibility === 'public' ? <Globe2 size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />} Visibilidad</span><strong>{form.visibility === 'public' ? 'Público' : 'Solo la red'}</strong></div>
              <button className="primary-button full" type="button" disabled={saving} onClick={requestPublish}>{publishReady ? 'Revisar publicación' : 'Ver qué falta'} <ChevronRight size={17} /></button>
            </div>
            <p className="editor-summary-help">Los borradores solo necesitan una comunidad y un título. Podrás completar el resto cuando quieras.</p>
          </aside>
        </div>
      </div>
      <PublicationReviewModal open={publicationOpen} form={form} bannerPreview={bannerPreview} missingLabels={publishMissingLabels} ready={publishReady} visibility={publicationVisibility} onVisibilityChange={setPublicationVisibility} onClose={() => setPublicationOpen(false)} onConfirm={() => void confirmPublish()} saving={saving} />
      <LeaveEditorModal open={leaveOpen} onClose={() => setLeaveOpen(false)} onDiscard={discardAndLeave} onSaveDraft={() => void persist('draft')} saving={saving} />
    </div>
  )
}

function EditorProgressStep({ id, number, label, active, complete, onClick }: { id: EditorSectionId; number: string; label: string; active: boolean; complete: boolean; onClick: () => void }) {
  return <button className={`editor-progress-step ${active ? 'active' : ''} ${complete ? 'complete' : ''}`} type="button" role="tab" aria-selected={active} aria-controls={`editor-${id}`} id={`editor-tab-${id}`} onClick={onClick}><span>{complete ? <Check size={14} aria-hidden="true" /> : number}</span><strong>{label}</strong></button>
}

function ChoiceCard({ name, value, checked, onChange, icon, label, description }: { name: string; value: string; checked: boolean; onChange: () => void; icon: ReactNode; label: string; description: string }) {
  return <label className={`choice-card ${checked ? 'selected' : ''}`}><input type="radio" name={name} value={value} checked={checked} onChange={onChange} /><span className="choice-card-icon">{icon}</span><span><strong>{label}</strong><small>{description}</small></span><span className="choice-card-check" aria-hidden="true"><Check size={14} /></span></label>
}

function MapPinIcon() { return <MapPinned size={19} aria-hidden="true" /> }

function FieldError({ id, message }: { id: string; message?: string }) { return message ? <small className="field-error" id={id}>{message}</small> : null }

function PublicationReviewModal({ open, form, bannerPreview, missingLabels, ready, visibility, onVisibilityChange, onClose, onConfirm, saving }: { open: boolean; form: EventInput; bannerPreview: string; missingLabels: string[]; ready: boolean; visibility: EventInput['visibility']; onVisibilityChange: (visibility: EventInput['visibility']) => void; onClose: () => void; onConfirm: () => void; saving: boolean }) {
  if (!open) return null
  const reviewStart = toLimaIso(form.startsAt)
  const reviewEnd = toLimaIso(form.endsAt)
  const reviewLocation = form.locationType === 'online' ? 'Online' : form.venueName.trim() || form.address.trim() || 'Ubicación por completar'
  return <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="publication-modal" role="dialog" aria-modal="true" aria-labelledby="publication-review-title" aria-describedby="publication-review-description" onMouseDown={(event) => event.stopPropagation()}>
    <div className="publication-modal-heading"><div><span className="dashboard-kicker">Última revisión</span><h2 id="publication-review-title">Publicar evento</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
    <p className="muted-copy" id="publication-review-description">Confirma que la información esté correcta y decide quién podrá ver esta actividad.</p>
    {bannerPreview && <img className="publication-review-cover" src={bannerPreview} alt={form.title.trim() ? `Banner de ${form.title.trim()}` : 'Vista previa del banner'} />}
    <div className="publication-event-summary"><div><CalendarDays size={17} aria-hidden="true" /><span><strong>Evento</strong><small>{form.title.trim() || 'Título por completar'}</small></span></div><div><Clock3 size={17} aria-hidden="true" /><span><strong>Horario</strong><small>{formatEventDateRange(reviewStart, reviewEnd, form.isAllDay)} · {formatTimeRange(reviewStart, reviewEnd, form.isAllDay)}</small></span></div><div><MapPinned size={17} aria-hidden="true" /><span><strong>Modalidad y lugar</strong><small>{form.locationType === 'hybrid' ? `Híbrido · ${reviewLocation}` : `${reviewLocation}`}</small></span></div></div>
    {ready ? <div className="publication-ready"><Check size={20} aria-hidden="true" /><span><strong>Todo listo para publicar</strong><small>{form.title || 'Este evento'} se mostrará con la visibilidad que elijas.</small></span></div> : <div className="publication-missing"><CircleAlert size={20} aria-hidden="true" /><div><strong>Aún faltan campos</strong><ul>{missingLabels.map((label) => <li key={label}>{label}</li>)}</ul><small>Vuelve al formulario para completar la información.</small></div></div>}
    <fieldset className="editor-choice-group publication-visibility"><legend>Visibilidad del evento</legend><div className="choice-grid choice-grid-two"><ChoiceCard name="publication-visibility" value="public" checked={visibility === 'public'} onChange={() => onVisibilityChange('public')} icon={<Globe2 size={19} aria-hidden="true" />} label="Público" description="Cualquier visitante podrá verlo" /><ChoiceCard name="publication-visibility" value="network" checked={visibility === 'network'} onChange={() => onVisibilityChange('network')} icon={<LockKeyhole size={19} aria-hidden="true" />} label="Solo la red" description="Solo usuarios autenticados" /></div></fieldset>
    <div className="publication-modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Volver a editar</button><button className="primary-button" type="button" disabled={!ready || saving} onClick={onConfirm}>{saving ? 'Publicando…' : visibility === 'public' ? 'Publicar como público' : 'Publicar solo para la red'}</button></div>
  </section></div>
}

function LeaveEditorModal({ open, onClose, onDiscard, onSaveDraft, saving }: { open: boolean; onClose: () => void; onDiscard: () => void; onSaveDraft: () => void; saving: boolean }) {
  if (!open) return null
  return <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="publication-modal leave-editor-modal" role="dialog" aria-modal="true" aria-labelledby="leave-editor-title" aria-describedby="leave-editor-description" onMouseDown={(event) => event.stopPropagation()}>
    <div className="publication-modal-heading"><div><span className="dashboard-kicker">Cambios sin guardar</span><h2 id="leave-editor-title">¿Salir del editor?</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
    <p className="muted-copy" id="leave-editor-description">Si sales ahora perderás la información de este evento. Puedes guardar un borrador y continuar después.</p>
    <div className="leave-editor-actions"><button className="secondary-button" type="button" onClick={onClose}>Seguir editando</button><button className="danger-button" type="button" disabled={saving} onClick={onDiscard}>Salir sin guardar</button><button className="primary-button" type="button" disabled={saving} onClick={onSaveDraft}>{saving ? 'Guardando…' : 'Guardar borrador y salir'}</button></div>
  </section></div>
}

function FieldLabel({ children, required }: { children: ReactNode; required: boolean }) {
  return <span className="field-label-row"><span>{children}</span>{required && <small className="field-required" aria-label="Obligatorio" title="Campo obligatorio">*</small>}</span>
}

function FormError({ message }: { message: string }) { return message ? <p className="form-message error" role="alert">{message}</p> : null }

type InviteRole = 'community_editor' | 'community_admin'

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer la imagen.')) }
    image.src = url
  })
}

function InviteMemberDialog({ open, inviteRole, isPlatformAdmin, communityOptions, onClose }: { open: boolean; inviteRole: InviteRole; isPlatformAdmin: boolean; communityOptions: { id: string; name: string }[]; onClose: () => void }) {
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>(communityOptions)
  const [communityId, setCommunityId] = useState('')
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState<InviteRole>(inviteRole)
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [communityLoading, setCommunityLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail('')
    setSelectedRole(inviteRole)
    setInviteUrl('')
    setMessage('')
    setError('')
    setLoading(false)
    setCommunities(communityOptions)
    setCommunityId(communityOptions[0]?.id || '')
    if (!isPlatformAdmin) return
    let cancelled = false
    setCommunityLoading(true)
    void listCommunities().then((items) => {
      if (cancelled) return
      const next = items.filter((item) => item.status === 'approved').map((item) => ({ id: item.id, name: item.name }))
      setCommunities(next)
      setCommunityId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || '')
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'No pudimos cargar las comunidades.')
    }).finally(() => {
      if (!cancelled) setCommunityLoading(false)
    })
    return () => { cancelled = true }
  }, [open, isPlatformAdmin, inviteRole, communityOptions])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null
  const title = isPlatformAdmin ? 'Invitar persona' : 'Invitar editor'
  const roleDescription = selectedRole === 'community_admin' ? 'administrador de comunidad' : 'editor de comunidad'
  const invite = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setInviteUrl('')
    setMessage('')
    if (!communityId) { setError('Selecciona una comunidad.'); return }
    setLoading(true)
    try {
      const result = await createInvitation(email, communityId, selectedRole)
      setInviteUrl(result.inviteUrl)
      setMessage('Invitación creada. Revisa el correo o comparte el enlace de un solo uso.')
      setEmail('')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos enviar la invitación.')
    } finally {
      setLoading(false)
    }
  }
  const copy = async () => { if (inviteUrl) await navigator.clipboard.writeText(inviteUrl) }

  return <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" aria-describedby="invite-dialog-description" onMouseDown={(event) => event.stopPropagation()}>
      <div className="invite-modal-header"><div><span className="dashboard-kicker">Accesos del panel</span><h2 id="invite-dialog-title">{title}</h2></div><button className="icon-button event-preview-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
      <p className="muted-copy" id="invite-dialog-description">La persona recibirá un enlace de un solo uso para activar su acceso como {roleDescription}.</p>
      <form className="invite-dialog-form" onSubmit={(event) => void invite(event)}>
        <label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@ejemplo.com" /></label>
        <label>Comunidad<select required value={communityId} disabled={communityLoading || !communities.length} onChange={(event) => setCommunityId(event.target.value)}><option value="">{communityLoading ? 'Cargando comunidades…' : 'Selecciona una comunidad'}</option>{communities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label>
        {isPlatformAdmin ? <label>Rol<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as InviteRole)}><option value="community_editor">Editor de comunidad</option><option value="community_admin">Administrador de comunidad</option></select></label> : <div className="invite-role-note"><span>Rol asignado</span><strong>{roleLabel(selectedRole)}</strong></div>}
        {error && <FormError message={error} />}
        {message && <p className="form-message success">{message}</p>}
        {inviteUrl && <div className="invite-result"><input readOnly value={inviteUrl} aria-label="Enlace de invitación" /><button className="icon-button" type="button" onClick={() => void copy()} aria-label="Copiar invitación"><Clipboard size={17} /></button></div>}
        <div className="invite-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={loading}>{loading ? 'Enviando…' : 'Enviar invitación'}</button></div>
      </form>
    </section>
  </div>
}

function CommunityInviteForm({ community }: { community: Community }) {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const invite = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setInviteUrl('')
    setMessage('')
    setLoading(true)
    try {
      const result = await createInvitation(email, community.id, 'community_editor')
      setInviteUrl(result.inviteUrl)
      setMessage('Invitación creada. Revisa el correo o comparte el enlace de un solo uso.')
      setEmail('')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos enviar la invitación.')
    } finally {
      setLoading(false)
    }
  }
  const copy = async () => { if (inviteUrl) await navigator.clipboard.writeText(inviteUrl) }
  return <section className="settings-section community-inline-invite-section">
    <h2>Invitar editor</h2>
    <p className="muted-copy">Ingresa el correo de la persona que tendrá permisos para crear y actualizar eventos de {community.name}.</p>
    <form className="invite-form community-inline-invite-form" onSubmit={(event) => void invite(event)}><label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@ejemplo.com" /></label><button className="primary-button" type="submit" disabled={loading}><Mail size={16} /> {loading ? 'Enviando…' : 'Enviar invitación'}</button></form>
    {error && <FormError message={error} />}
    {message && <p className="form-message success">{message}</p>}
    {inviteUrl && <div className="invite-result"><input readOnly value={inviteUrl} aria-label="Enlace de invitación" /><button className="icon-button" type="button" onClick={() => void copy()} aria-label="Copiar invitación"><Clipboard size={17} /></button></div>}
  </section>
}

export function CommunitySettingsPage() {
  const { memberships, roles } = useAuth()
  const isPlatformAdmin = roles.includes('platform_admin')
  const manageable = memberships.filter((membership) => membership.role === 'community_admin' || membership.role === 'platform_admin')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const [communities, setCommunities] = useState<Community[]>([])
  const [communityId, setCommunityId] = useState('')
  const [community, setCommunity] = useState<Community | null>(null)
  const [activeSection, setActiveSection] = useState<'members' | 'public'>('members')
  const [communityMembers, setCommunityMembers] = useState<CommunityMember[]>([])
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberError, setMemberError] = useState('')
  const [memberActionId, setMemberActionId] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoMessage, setLogoMessage] = useState('')
  const [logoError, setLogoError] = useState('')
  useEffect(() => {
    if (!isPlatformAdmin && !manageableIds) { setCommunities([]); return }
    void listCommunities(isPlatformAdmin).then((items) => {
      const allowedIds = new Set(manageableIds ? manageableIds.split(',') : [])
      const next = isPlatformAdmin ? items.filter((item) => item.status === 'approved') : items.filter((item) => allowedIds.has(item.id))
      setCommunities(next)
      setCommunityId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || '')
    })
  }, [isPlatformAdmin, manageableIds])
  useEffect(() => {
    const selected = communities.find((item) => item.id === communityId) || null
    setCommunity(selected)
  }, [communityId, communities])
  useEffect(() => {
    setActiveSection('members')
    setCommunityMembers([])
    setMemberActionId(null)
    setLogoFile(null)
    setLogoPreview('')
    setLogoMessage('')
    setLogoError('')
  }, [communityId])
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
  }, [logoPreview])
  useEffect(() => {
    if (!communityId) { setMemberLoading(false); setMemberError(''); return }
    let cancelled = false
    setMemberLoading(true)
    setMemberError('')
    void listCommunityMembers(communityId)
      .then((next) => { if (!cancelled) setCommunityMembers(next) })
      .catch((reason: unknown) => { if (!cancelled) setMemberError(reason instanceof Error ? reason.message : 'No pudimos cargar los correos registrados.') })
      .finally(() => { if (!cancelled) setMemberLoading(false) })
    return () => { cancelled = true }
  }, [communityId])
  const removeMember = async (member: CommunityMember) => {
    if (!canRemoveCommunityMember(member, isPlatformAdmin)) return
    const isInvitation = member.status === 'invited' && Boolean(member.invitationId)
    const actionId = isInvitation ? member.invitationId : member.membershipId
    if (!actionId) return
    const actionDescription = isInvitation ? `cancelar la invitación para ${member.email}` : `revocar el acceso de ${member.email}`
    if (!window.confirm(`¿Quieres ${actionDescription}?`)) return
    setMemberActionId(actionId)
    setMemberError('')
    try {
      if (isInvitation) await cancelCommunityInvitation(actionId)
      else await revokeCommunityMember(actionId)
      setCommunityMembers((current) => current.filter((item) => item.membershipId !== member.membershipId && item.invitationId !== member.invitationId))
    } catch (reason: unknown) {
      setMemberError(reason instanceof Error ? reason.message : 'No pudimos actualizar el acceso.')
    } finally {
      setMemberActionId(null)
    }
  }
  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setLogoMessage('')
    setLogoError('')
    setLogoFile(null)
    setLogoPreview('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setLogoError('El logo debe estar en formato JPG, PNG o WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setLogoError('El logo no puede superar los 5 MB.'); return }
    try {
      const dimensions = await readImageSize(file)
      if (dimensions.width !== dimensions.height) { setLogoError('El logo debe ser cuadrado, con proporción 1:1.'); return }
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    } catch (reason: unknown) {
      setLogoError(reason instanceof Error ? reason.message : 'No pudimos leer la imagen.')
    }
  }
  const saveLogo = async () => {
    if (!logoFile || !community) return
    if (!supabase) { setLogoError('Supabase no está configurado.'); return }
    setLogoUploading(true)
    setLogoError('')
    setLogoMessage('')
    try {
      const path = await uploadCommunityLogo(community.id, logoFile, community.logoPath)
      setCommunities((current) => current.map((item) => item.id === community.id ? { ...item, logoPath: path } : item))
      setLogoFile(null)
      setLogoPreview('')
      setLogoMessage('Logo actualizado.')
    } catch (reason: unknown) {
      setLogoError(reason instanceof Error ? reason.message : 'No pudimos actualizar el logo.')
    } finally {
      setLogoUploading(false)
    }
  }
  if (!communities.length) return <div className="dashboard-page narrow-page community-settings-page"><div className="empty-state"><Users size={30} aria-hidden="true" /><h3>{isPlatformAdmin ? 'No hay comunidades aprobadas' : 'No tienes comunidades administrables'}</h3><p>{isPlatformAdmin ? 'Aprueba una comunidad desde Administración IGDA para gestionar sus accesos.' : 'Cuando una comunidad te asigne permisos de administración, aparecerá aquí.'}</p></div></div>
  if (!community) return <LoadingState label="Cargando comunidad" />
  return <div className="dashboard-page narrow-page community-settings-page">
    <section className="community-selector-panel" aria-label="Seleccionar comunidad">
      <label className="community-selector" htmlFor="managed-community">Comunidad<select id="managed-community" value={communityId} onChange={(event) => setCommunityId(event.target.value)}>{communities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    </section>
    <section className="settings-section community-content-section" aria-label="Contenido de la comunidad">
      <div className="community-view-switch" role="tablist" aria-label="Secciones de la comunidad">
        <button type="button" role="tab" aria-selected={activeSection === 'public'} aria-controls="community-public-panel" onClick={() => setActiveSection('public')}>Información pública</button>
        <button type="button" role="tab" aria-selected={activeSection === 'members'} aria-controls="community-members-panel" onClick={() => setActiveSection('members')}>Correos registrados</button>
      </div>
      {activeSection === 'members' ? <div className="community-tab-content" id="community-members-panel" role="tabpanel" aria-label="Correos registrados">
        <div className="community-panel-heading"><div><h2>Correos registrados</h2><p className="muted-copy">Accesos activos e invitaciones pendientes. No mostramos nombres ni contraseñas.</p></div><span className="member-count" aria-label={`${communityMembers.length} correos registrados`}>{communityMembers.length}</span></div>
        {memberLoading && <LoadingState label="Cargando correos" />}
        {memberError && <FormError message={memberError} />}
        {!memberLoading && !memberError && (communityMembers.length ? <ul className="member-email-list">{communityMembers.map((member) => { const actionId = member.invitationId || member.membershipId; const removable = canRemoveCommunityMember(member, isPlatformAdmin); return <li className="member-email-row" key={actionId || member.email}><Mail size={16} aria-hidden="true" /><span className="member-email-content"><a className="member-email-link" href={`mailto:${member.email}`}>{member.email}</a><small className="member-email-meta">{member.status === 'invited' ? 'Invitación pendiente' : 'Acceso activo'} · {roleLabel(member.role)}</small></span>{removable && <button className="icon-button danger" type="button" disabled={memberActionId === actionId} onClick={() => void removeMember(member)} aria-label={member.status === 'invited' ? `Cancelar invitación a ${member.email}` : `Revocar acceso de ${member.email}`}>{memberActionId === actionId ? <RefreshCw size={16} className="spin" /> : <X size={16} />}</button>}</li> })}</ul> : <div className="members-empty"><Mail size={24} aria-hidden="true" /><p>Aún no hay personas registradas en esta comunidad.</p></div>)}
      </div> : <div className="community-tab-content" id="community-public-panel" role="tabpanel" aria-label="Información pública">
        <div className="community-panel-heading"><div><h2>Información pública</h2><p className="muted-copy">Estos datos vienen heredados desde Google Sheets y son de solo lectura.</p></div><span className="readonly-badge">Solo lectura</span></div>
        <dl className="public-info-grid">
          <div><dt>Nombre</dt><dd>{community.name}</dd></div>
          <div><dt>Descripción</dt><dd>{community.description || 'Sin descripción registrada.'}</dd></div>
          {community.websiteUrl && <div><dt>Sitio web</dt><dd><a href={community.websiteUrl} target="_blank" rel="noreferrer">{community.websiteUrl}</a></dd></div>}
          {community.discordUrl && <div><dt>Discord</dt><dd><a href={community.discordUrl} target="_blank" rel="noreferrer">{community.discordUrl}</a></dd></div>}
        </dl>
        <div className="community-logo-editor">
          <CommunityLogo path={logoPreview || community.logoPath} name={community.name} size="large" />
          <div className="community-logo-copy"><h3>Logo de la comunidad</h3><p className="muted-copy">Este es el único dato editable desde el panel. Usa una imagen cuadrada en formato JPG, PNG o WebP.</p><label className="logo-file-field">Seleccionar logo<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Logo de la comunidad" onChange={(event) => void handleLogoChange(event)} /></label>{logoPreview && <button className="primary-button logo-save-button" type="button" disabled={logoUploading} onClick={() => void saveLogo()}>{logoUploading ? 'Actualizando…' : 'Actualizar logo'}</button>}{logoError && <FormError message={logoError} />}{logoMessage && <p className="form-message success" role="status">{logoMessage}</p>}<small className="field-help">Proporción obligatoria 1:1 · máximo 5 MB.</small></div>
        </div>
      </div>}
    </section>
    {!isPlatformAdmin && <CommunityInviteForm community={community} />}
  </div>
}

export function PlatformAdminPage() {
  const { roles } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [reports, setReports] = useState<EventReport[]>([])
  const [syncResult, setSyncResult] = useState<CommunitySyncResult | null>(null)
  const [calendarSyncResult, setCalendarSyncResult] = useState<GoogleCalendarSyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [calendarSyncing, setCalendarSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [calendarSyncError, setCalendarSyncError] = useState('')
  const load = () => { setLoading(true); void Promise.all([listCommunities(true), listEventReports()]).then(([nextCommunities, nextReports]) => { setCommunities(nextCommunities); setReports(nextReports) }).finally(() => setLoading(false)) }
  useEffect(load, [])
  if (!roles.includes('platform_admin')) return <div className="dashboard-page"><PanelTitle title="Sin acceso" description="Esta sección está reservada para administradores de IGDA Perú." /></div>
  const create = async (event: FormEvent) => { event.preventDefault(); if (!newName.trim()) return; try { await createCommunity(newName.trim(), slugify(newName)); setNewName(''); load() } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos crear la comunidad.') } }
  const moderate = async (community: Community, status: 'approved' | 'suspended') => { await updateCommunityStatus(community.id, status); load() }
  const sync = async () => {
    setSyncing(true)
    setSyncError('')
    setSyncResult(null)
    try {
      const result = await syncCommunitiesFromSheet()
      setSyncResult(result)
      load()
    } catch (reason: unknown) {
      setSyncError(reason instanceof Error ? reason.message : 'No pudimos sincronizar las comunidades.')
    } finally {
      setSyncing(false)
    }
  }
  const syncCalendar = async () => {
    setCalendarSyncing(true)
    setCalendarSyncError('')
    setCalendarSyncResult(null)
    try {
      setCalendarSyncResult(await syncEventsToGoogleCalendar())
    } catch (reason: unknown) {
      setCalendarSyncError(reason instanceof Error ? reason.message : 'No pudimos sincronizar Google Calendar.')
    } finally {
      setCalendarSyncing(false)
    }
  }
  return <div className="dashboard-page"><PanelTitle title="Administración IGDA" description="Aprueba comunidades y conserva el control de la red." /><section className="admin-create"><form onSubmit={create}><input aria-label="Nombre de la nueva comunidad" placeholder="Nombre de la nueva comunidad" value={newName} onChange={(event) => setNewName(event.target.value)} /><button className="primary-button"><Plus size={16} /> Crear comunidad</button></form>{error && <FormError message={error} />}</section><section className="settings-section admin-sync"><div className="sync-heading"><div><h2>Actualizar desde Google Sheets</h2><p className="muted-copy">Importa manualmente la pestaña <strong>TO NOTION</strong>. Solo se procesan filas con <strong>VALIDACIÓN</strong> activa.</p></div><button className="primary-button" type="button" onClick={() => void sync()} disabled={syncing}><RefreshCw size={16} className={syncing ? 'spin' : ''} /> {syncing ? 'Actualizando…' : 'Actualizar comunidades'}</button></div><p className="muted-copy">Las comunidades nuevas quedan aprobadas. El estado de una comunidad existente, incluida una suspensión, se conserva en esta aplicación.</p>{syncError && <FormError message={syncError} />}{syncResult && <div className="sync-result" role="status"><strong>Actualización completada</strong><span>{syncResult.created} creadas · {syncResult.updated} actualizadas · {syncResult.skipped} omitidas</span>{syncResult.skippedRows.length > 0 && <details><summary>Ver filas omitidas</summary><ul>{syncResult.skippedRows.map((row, index) => <li key={`${row.sourceId || 'row'}-${row.row}-${index}`}>{row.name || row.sourceId || `Fila ${row.row}`}: {row.reason}</li>)}</ul></details>}</div>}</section><section className="settings-section admin-sync"><div className="sync-heading"><div><h2>Publicar en Google Calendar</h2><p className="muted-copy">Sincroniza únicamente eventos <strong>publicados</strong>, <strong>públicos</strong> y de comunidades aprobadas.</p></div><button className="primary-button" type="button" onClick={() => void syncCalendar()} disabled={calendarSyncing}><CalendarDays size={16} className={calendarSyncing ? 'spin' : ''} /> {calendarSyncing ? 'Sincronizando…' : 'Sincronizar calendario'}</button></div><p className="muted-copy">Los eventos retirados, suspendidos o cambiados a visibilidad de red se eliminan del calendario oficial.</p>{calendarSyncError && <FormError message={calendarSyncError} />}{calendarSyncResult && <div className="sync-result" role="status"><strong>Calendario actualizado</strong><span>{calendarSyncResult.created} creados · {calendarSyncResult.updated} actualizados · {calendarSyncResult.removed} retirados{calendarSyncResult.errors ? ` · ${calendarSyncResult.errors} con error` : ''}</span>{calendarSyncResult.errorItems.length > 0 && <details><summary>Ver errores</summary><ul>{calendarSyncResult.errorItems.map((item, index) => <li key={`${item.eventId || 'event'}-${index}`}>{item.eventId || 'Evento'}: {item.message}</li>)}</ul></details>}</div>}</section>{loading ? <LoadingState label="Cargando comunidades" /> : <><div className="admin-list">{communities.map((community) => <div className="admin-row" key={community.id}><div><strong>{community.name}</strong><small>{community.slug} · {community.status}</small></div><div className="row-actions">{community.status === 'pending' && <button className="secondary-button" type="button" onClick={() => void moderate(community, 'approved')}><Check size={16} /> Aprobar</button>}{community.status === 'approved' && <button className="icon-button danger" type="button" onClick={() => void moderate(community, 'suspended')} aria-label={`Suspender ${community.name}`}><X size={17} /></button>}{community.status === 'suspended' && <button className="secondary-button" type="button" onClick={() => void moderate(community, 'approved')}>Reactivar</button>}</div></div>)}</div><section className="settings-section admin-reports"><h2>Reportes pendientes</h2>{reports.length ? <div className="report-list">{reports.map((report) => <div className="report-row" key={report.id}><div><strong>{report.eventTitle}</strong><p>{report.reason}</p></div><button className="secondary-button" type="button" onClick={() => void resolveEventReport(report.id).then(load)}>Marcar revisado</button></div>)}</div> : <p className="muted-copy">No hay reportes pendientes.</p>}</section></>}</div>
}
