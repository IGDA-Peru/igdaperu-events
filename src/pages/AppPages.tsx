import { CalendarDays, Check, ChevronRight, CircleAlert, Clipboard, Clock3, Globe2, Link2, LockKeyhole, Mail, MapPinned, Plus, RefreshCw, Shield, UserPlus, Users, Video, X } from 'lucide-react'
import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EmptyEvents, EventCard } from '../components/EventCard'
import { CommunityLogo } from '../components/CommunityLogo'
import { LoadingState } from '../components/Feedback'
import { GooglePlacePicker } from '../components/GooglePlacePicker'
import { archiveEvent, createCommunity, deleteEvent, listCommunities, listCommunityMemberEmails, listEventReports, listManagedEvents, resolveEventReport, saveEvent, syncCommunitiesFromSheet, syncEventsToGoogleCalendar, updateCommunityStatus, uploadCommunityLogo } from '../lib/data'
import { eventFieldLabels, validateEvent, type EventField } from '../lib/eventValidation'
import { formatDate, formatTimeRange, isEventPast, slugify } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Community, CommunitySyncResult, EventInput, EventItem, EventReport, GoogleCalendarSyncResult, Membership, Role } from '../types'

function PanelTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function roleLabel(role: Role) {
  return { reader: 'Lector', community_editor: 'Editor de comunidad', community_admin: 'Administrador de comunidad', platform_admin: 'Administrador IGDA' }[role]
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
  const communityOptions = useMemo(() => memberships.filter((membership) => membership.role === 'community_admin' && membership.communityId).map((membership) => ({ id: membership.communityId, name: membership.communityName })), [memberships])
  const visibleMemberships = memberships.filter((membership) => membership.communityId)
  const canManageCommunity = isPlatformAdmin || communityOptions.length > 0
  const inviteRole = isPlatformAdmin ? 'community_admin' : 'community_editor'
  const [inviteOpen, setInviteOpen] = useState(false)
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
      <div className="dashboard-grid">
        <aside className="dashboard-sidebar">
          <div className="dashboard-welcome"><span className="dashboard-kicker">Tus comunidades</span><h1>Hola{profile?.displayName ? `, ${profile.displayName}` : ''}</h1></div>
          {visibleMemberships.length ? <div className="membership-list">{visibleMemberships.map((membership) => <div className="membership-row" key={membership.communityId}><span className="membership-avatar"><Users size={18} /></span><span><strong>{membership.communityName}</strong><small>{roleLabel(membership.role)}</small></span></div>)}</div> : <p className="muted-copy">Aún no tienes permisos de gestión. Puedes seguir consultando los eventos de la red.</p>}
          {canManageCommunity && <>
            <button className="secondary-button full dashboard-invite-button" type="button" onClick={() => setInviteOpen(true)}><UserPlus size={17} /> {isPlatformAdmin ? 'Invitar persona' : 'Invitar editor'}</button>
            <Link className="secondary-button full" to="/app/comunidad">{isPlatformAdmin ? 'Gestionar comunidades' : 'Gestionar comunidad'}</Link>
          </>}
          {roles.includes('platform_admin') && <Link className="secondary-button full" to="/app/admin">Administración IGDA</Link>}
        </aside>
        <section className="dashboard-main">
          <div className="dashboard-panel-heading"><h2>Tus eventos</h2><div className="dashboard-panel-actions">{canManage && <Link className="primary-button" to="/app/eventos/nuevo"><Plus size={17} /> Nuevo evento</Link>}</div></div>
          {message && <p className="form-message success">{message}</p>}
          {actionError && <p className="form-message error">{actionError}</p>}
          {loading ? <LoadingState label="Cargando tus eventos" /> : events.length ? <div className="event-list">{events.slice(0, 5).map((event) => <EventCard event={event} compact panelActions={{ onArchive: () => void archive(event), onDelete: () => void remove(event), canDelete: canDeleteEvent(event, memberships, isPlatformAdmin) }} key={event.id} />)}</div> : <EmptyEvents authenticated />}
        </section>
      </div>
      {user && <p className="account-caption">Sesión iniciada como {user.email}</p>}
      <InviteMemberDialog open={inviteOpen} inviteRole={inviteRole} isPlatformAdmin={isPlatformAdmin} communityOptions={communityOptions} onClose={() => setInviteOpen(false)} />
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
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const load = () => { setLoading(true); void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then(setEvents).finally(() => setLoading(false)) }
  useEffect(load, [manageableIds, isPlatformAdmin])
  const archive = async (event: EventItem) => { setActionError(''); try { await archiveEvent(event.id); setMessage('Evento archivado.'); load() } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : 'No pudimos archivar el evento.') } }
  const remove = async (event: EventItem) => { if (!window.confirm(`¿Eliminar “${event.title}”? Esta acción no se puede deshacer.`)) return; setActionError(''); try { await deleteEvent(event.id); setMessage('Evento eliminado.'); load() } catch (reason: unknown) { setActionError(reason instanceof Error ? reason.message : 'No pudimos eliminar el evento.') } }
  return <div className="dashboard-page"><PanelTitle title="Tus eventos" description="Crea, publica y actualiza los eventos de tus comunidades." action={<Link className="primary-button" to="/app/eventos/nuevo"><Plus size={17} /> Nuevo evento</Link>} />{message && <p className="form-message success">{message}</p>}{actionError && <p className="form-message error">{actionError}</p>}{loading ? <LoadingState label="Cargando eventos" /> : events.length ? <div className="managed-event-list">{events.map((event) => <EventCard event={event} compact panelActions={{ onArchive: () => void archive(event), onDelete: () => void remove(event), canDelete: canDeleteEvent(event, memberships, isPlatformAdmin) }} key={event.id} />)}</div> : <EmptyEvents authenticated />}</div>
}

const emptyEvent: EventInput = { communityId: '', title: '', slug: '', description: '', type: 'CHARLA', startsAt: '', endsAt: '', locationType: 'venue', venueName: '', address: '', mapUrl: '', placeId: '', formattedAddress: '', latitude: null, longitude: null, meetingUrl: '', meetingProvider: 'other', visibility: 'public', status: 'draft' }

function toLimaIso(value: string) {
  if (!value) return ''
  const date = new Date(`${value}:00-05:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
function fromIso(value: string | null | undefined) { if (!value) return ''; const date = new Date(value); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).reduce<Record<string, string>>((acc, part) => { acc[part.type] = part.value; return acc }, {}); return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` }

function eventPayload(input: EventInput): EventInput {
  return { ...input, slug: input.slug || slugify(input.title) || `borrador-${Date.now()}`, startsAt: toLimaIso(input.startsAt), endsAt: toLimaIso(input.endsAt) }
}

export function EventEditorPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { memberships, roles } = useAuth()
  const manageable = memberships.filter((membership) => membership.role !== 'reader')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const isPlatformAdmin = roles.includes('platform_admin')
  const [availableCommunities, setAvailableCommunities] = useState<Community[]>([])
  const [managedEvents, setManagedEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<EventInput>(emptyEvent)
  const [loading, setLoading] = useState(Boolean(eventId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EventField, string>>>({})
  const [publicationOpen, setPublicationOpen] = useState(false)
  const [publicationVisibility, setPublicationVisibility] = useState<EventInput['visibility']>('public')
  const [dirty, setDirty] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const intentionalNavigationRef = useRef(false)
  const currentEvent = managedEvents.find((event) => event.id === eventId)

  useEffect(() => { if (isPlatformAdmin) void listCommunities(true).then(setAvailableCommunities); else setAvailableCommunities(manageable.map((membership) => ({ id: membership.communityId, slug: membership.communitySlug, name: membership.communityName, description: '', status: 'approved' }))) }, [isPlatformAdmin, manageableIds])
  useEffect(() => { if (!manageable.length && !isPlatformAdmin) { setLoading(false); return } void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then((items) => { setManagedEvents(items); const item = items.find((event) => event.id === eventId); if (item) { setForm({ communityId: item.communityId, title: item.title, slug: item.slug, description: item.description || '', type: item.type, startsAt: fromIso(item.startsAt), endsAt: fromIso(item.endsAt), locationType: item.locationType, venueName: item.venueName || '', address: item.address || '', mapUrl: item.mapUrl || '', placeId: item.placeId || '', formattedAddress: item.formattedAddress || '', latitude: item.latitude ?? null, longitude: item.longitude ?? null, meetingUrl: item.meetingUrl || '', meetingProvider: item.meetingProvider || 'other', visibility: item.visibility, status: item.status }); setDirty(false) } }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar el evento.')).finally(() => setLoading(false)) }, [eventId, manageableIds, isPlatformAdmin])
  useEffect(() => { if (!eventId && !form.communityId && availableCommunities[0]) setForm((current) => ({ ...current, communityId: availableCommunities[0].id })) }, [eventId, form.communityId, availableCommunities])
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { if (intentionalNavigationRef.current) return; event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])

  const update = <K extends keyof EventInput>(key: K, value: EventInput[K]) => { setDirty(true); setForm((current) => ({ ...current, [key]: value })); if (fieldErrors[key as EventField]) setFieldErrors((current) => ({ ...current, [key as EventField]: undefined })) }
  const updateLocation = (selection: { placeId: string; formattedAddress: string; venueName: string; address: string; latitude: number; longitude: number; mapUrl: string }) => {
    setDirty(true)
    setFieldErrors((current) => ({ ...current, location: undefined, mapUrl: undefined }))
    setForm((current) => ({ ...current, ...selection }))
  }
  const needsMeetingLink = form.locationType !== 'venue'
  const needsPhysicalLocation = form.locationType !== 'online'
  const hasPast = currentEvent ? isEventPast(currentEvent) : false
  const deleteAllowed = currentEvent ? canDeleteEvent(currentEvent, memberships, isPlatformAdmin) : false
  const publishValidation = validateEvent(form, 'publish')
  const draftValidation = validateEvent(form, 'draft')
  const publishReady = publishValidation.valid
  const publishMissingLabels = publishValidation.missing.map((field) => eventFieldLabels[field])
  const statusLabel = currentEvent ? (hasPast ? 'Ya pasó' : currentEvent.status === 'published' ? 'Publicado' : currentEvent.status === 'draft' ? 'Borrador' : 'Archivado') : 'Borrador nuevo'

  const openMapsSearch = () => {
    const query = [form.venueName, form.address].map((value) => value.trim()).filter(Boolean).join(', ')
    if (!query) { setError('Escribe el nombre del lugar o la dirección para buscarlo en Google Maps.'); return }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
  }

  const persist = async (status: EventInput['status'], visibility = form.visibility) => {
    const validation = validateEvent(form, status === 'draft' ? 'draft' : 'publish')
    setFieldErrors(validation.errors)
    if (!validation.valid) { setError(status === 'draft' ? 'Para guardar el borrador, selecciona una comunidad y escribe un título de al menos 3 caracteres.' : 'Completa los campos pendientes antes de publicar.'); return false }
    setSaving(true); setError('')
    try { await saveEvent(eventPayload({ ...form, status, visibility }), currentEvent?.id); intentionalNavigationRef.current = true; setDirty(false); navigate('/app/eventos'); return true } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el evento.'); return false } finally { setSaving(false) }
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
    if (dirty && !intentionalNavigationRef.current && !window.confirm('Tienes cambios sin guardar. ¿Quieres salir del editor?')) event.preventDefault()
  }

  if (loading) return <LoadingState label="Cargando editor" />
  return (
    <div className="dashboard-page event-editor-page">
      <div className="event-editor-heading">
        <div>
          <Link className="back-link" to="/app/eventos" onClick={confirmLeave}><ChevronRight size={18} className="back-icon" /> Tus eventos</Link>
          <h1>{eventId ? 'Editar evento' : 'Crear evento'}</h1>
        </div>
        <span className={`status-label ${currentEvent?.status || 'draft'}`}>{statusLabel}</span>
      </div>
      <div className="editor-progress" aria-label="Progreso del formulario">
        <EditorProgressStep number="01" label="Información" complete={Boolean(form.communityId && form.title.trim().length >= 3)} />
        <EditorProgressStep number="02" label="Fecha y hora" complete={Boolean(form.startsAt && form.endsAt && (!form.startsAt || !form.endsAt || new Date(form.endsAt) > new Date(form.startsAt)))} />
        <EditorProgressStep number="03" label="Ubicación" complete={Boolean((form.locationType === 'online' || form.venueName.trim() || form.address.trim() || form.latitude !== null) && (form.locationType === 'venue' || form.meetingUrl.trim()))} />
        <EditorProgressStep number="04" label="Publicación" complete={publishReady} />
      </div>
      <div className="event-editor-layout">
        <form className="event-editor-card" onSubmit={(event) => void save(event)}>
          <section className="editor-section" id="editor-information">
            <EditorSectionHeading number="01" icon={<Users size={19} aria-hidden="true" />} title="Información principal" description="Dale a tu actividad un nombre claro y una descripción útil." />
            <div className="form-grid">
              <label className="editor-field"><FieldLabel required>Comunidad</FieldLabel><select aria-invalid={Boolean(fieldErrors.communityId)} aria-describedby={fieldErrors.communityId ? 'event-community-error' : undefined} value={form.communityId} onChange={(event) => update('communityId', event.target.value)}><option value="">Selecciona una comunidad</option>{availableCommunities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select><FieldError id="event-community-error" message={fieldErrors.communityId} /></label>
              <label className="editor-field"><FieldLabel required>Título del evento</FieldLabel><input aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'event-title-error' : undefined} value={form.title} onChange={(event) => { update('title', event.target.value); if (!eventId) update('slug', slugify(event.target.value)) }} placeholder="Ej. Meetup de desarrollo indie" /><FieldError id="event-title-error" message={fieldErrors.title} /></label>
            </div>
            <div className="form-grid">
              <label className="editor-field"><FieldLabel required={false}>Tipo de actividad</FieldLabel><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>CHARLA</option><option>TALLER</option><option>MEETUP</option><option>GAME JAM</option><option>CONFERENCIA</option></select></label>
              <div className="field-spacer" aria-hidden="true" />
            </div>
            <label className="editor-field"><FieldLabel required>Descripción</FieldLabel><textarea aria-invalid={Boolean(fieldErrors.description)} aria-describedby="event-description-help event-description-error" rows={5} maxLength={5000} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Cuenta qué aprenderán o encontrarán las personas asistentes." /><div className="field-meta"><small className="field-help" id="event-description-help">Puedes incluir agenda, público objetivo o requisitos.</small><small className="field-count">{form.description.length}/5000</small></div><FieldError id="event-description-error" message={fieldErrors.description} /></label>
          </section>

          <section className="editor-section" id="editor-datetime">
            <EditorSectionHeading number="02" icon={<CalendarDays size={19} aria-hidden="true" />} title="Fecha y hora" description="Usamos la hora de Lima para que todas las personas vean el mismo horario." />
            <div className="form-grid">
              <label className="editor-field"><FieldLabel required>Inicio</FieldLabel><input type="datetime-local" aria-invalid={Boolean(fieldErrors.startsAt)} aria-describedby={fieldErrors.startsAt ? 'event-start-error' : undefined} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /><FieldError id="event-start-error" message={fieldErrors.startsAt} /></label>
              <label className="editor-field"><FieldLabel required>Fin</FieldLabel><input type="datetime-local" aria-invalid={Boolean(fieldErrors.endsAt)} aria-describedby={fieldErrors.endsAt ? 'event-end-error' : undefined} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /><FieldError id="event-end-error" message={fieldErrors.endsAt} /></label>
            </div>
            <p className="editor-inline-note"><Clock3 size={16} aria-hidden="true" /> Hora de Lima · America/Lima</p>
          </section>

          <section className="editor-section" id="editor-location">
            <EditorSectionHeading number="03" icon={<MapPinned size={19} aria-hidden="true" />} title="Ubicación y acceso" description="Indica dónde se encontrarán y cómo podrán conectarse." />
            <fieldset className="editor-choice-group"><legend><FieldLabel required>Modalidad</FieldLabel></legend><div className="choice-grid choice-grid-three">{(['venue', 'online', 'hybrid'] as const).map((locationType) => <ChoiceCard key={locationType} name="locationType" value={locationType} checked={form.locationType === locationType} onChange={() => update('locationType', locationType)} icon={locationType === 'venue' ? <MapPinIcon /> : locationType === 'online' ? <Video size={19} aria-hidden="true" /> : <><MapPinIcon /><Video size={17} aria-hidden="true" /></>} label={locationType === 'venue' ? 'Presencial' : locationType === 'online' ? 'Online' : 'Híbrido'} description={locationType === 'venue' ? 'En un lugar físico' : locationType === 'online' ? 'Solo por videollamada' : 'Lugar y videollamada'} />)}</div></fieldset>
            {needsPhysicalLocation && <div className="location-editor-block">
              <div className="form-grid">
                <label className="editor-field"><FieldLabel required={false}>Nombre del lugar</FieldLabel><input value={form.venueName} onChange={(event) => update('venueName', event.target.value)} placeholder="Ej. Casa Cultural, Lima" /></label>
                <label className="editor-field"><FieldLabel required={false}>Dirección</FieldLabel><input aria-invalid={Boolean(fieldErrors.location)} value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Av. / calle, distrito, ciudad" /></label>
              </div>
              <div className="location-group-heading"><div><h3>Selecciona el punto exacto</h3><p className="field-help">Busca el lugar en el mapa y mueve el pin si es necesario.</p></div><div className="location-tools"><button className="secondary-button compact-button" type="button" aria-expanded={mapOpen} onClick={() => setMapOpen((current) => !current)}><MapPinned size={16} /> {mapOpen ? 'Ocultar mapa' : 'Seleccionar en mapa'}</button><button className="secondary-button compact-button" type="button" onClick={openMapsSearch}><Link2 size={16} /> Abrir Google Maps</button></div></div>
              {mapOpen && <GooglePlacePicker address={form.address} latitude={form.latitude} longitude={form.longitude} venueName={form.venueName} onChange={updateLocation} />}
              <label className="editor-field"><FieldLabel required={false}>Enlace de Google Maps</FieldLabel><input type="url" aria-invalid={Boolean(fieldErrors.mapUrl)} aria-describedby={fieldErrors.mapUrl ? 'event-map-error' : undefined} value={form.mapUrl} onChange={(event) => update('mapUrl', event.target.value)} placeholder="Se completa al seleccionar el lugar" /><FieldError id="event-map-error" message={fieldErrors.mapUrl} /></label>
              <FieldError id="event-location-error" message={fieldErrors.location} />
            </div>}
            <div className="access-editor-block">
              <div className="access-heading"><div><h3>Acceso online</h3><p className="field-help">Por ahora puedes pegar un enlace de Zoom, Meet u otra plataforma.</p></div><span className="future-note">Conectar cuenta próximamente</span></div>
              <fieldset className="editor-choice-group"><legend><FieldLabel required={needsMeetingLink}>Plataforma</FieldLabel></legend><div className="choice-grid choice-grid-three meeting-provider-grid"><ChoiceCard name="meeting-provider" value="zoom" checked={form.meetingProvider === 'zoom'} onChange={() => update('meetingProvider', 'zoom')} icon={<Video size={19} aria-hidden="true" />} label="Zoom" description="Enlace manual" /><ChoiceCard name="meeting-provider" value="google_meet" checked={form.meetingProvider === 'google_meet'} onChange={() => update('meetingProvider', 'google_meet')} icon={<Globe2 size={19} aria-hidden="true" />} label="Google Meet" description="Enlace manual" /><ChoiceCard name="meeting-provider" value="other" checked={form.meetingProvider === 'other'} onChange={() => update('meetingProvider', 'other')} icon={<Link2 size={19} aria-hidden="true" />} label="Otra plataforma" description="Enlace manual" /></div></fieldset>
              <label className="editor-field"><FieldLabel required={needsMeetingLink}>Enlace para unirse</FieldLabel><input type="url" aria-invalid={Boolean(fieldErrors.meetingUrl)} aria-describedby="event-meeting-help event-meeting-error" value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="https://…" /><div className="field-meta"><small className="field-help" id="event-meeting-help">{needsMeetingLink ? 'Es obligatorio para eventos online e híbridos.' : 'Opcional para eventos presenciales.'}</small></div><FieldError id="event-meeting-error" message={fieldErrors.meetingUrl} /></label>
            </div>
          </section>

          <section className="editor-section" id="editor-publication">
            <EditorSectionHeading number="04" icon={<Globe2 size={19} aria-hidden="true" />} title="Publicación" description="Elige quién podrá encontrar este evento." />
            <fieldset className="editor-choice-group"><legend><FieldLabel required>Visibilidad</FieldLabel></legend><div className="choice-grid choice-grid-two"><ChoiceCard name="visibility" value="public" checked={form.visibility === 'public'} onChange={() => update('visibility', 'public')} icon={<Globe2 size={19} aria-hidden="true" />} label="Público" description="Cualquier visitante, agenda y embed" /><ChoiceCard name="visibility" value="network" checked={form.visibility === 'network'} onChange={() => update('visibility', 'network')} icon={<LockKeyhole size={19} aria-hidden="true" />} label="Solo la red" description="Personas con una cuenta activa" /></div></fieldset>
            <p className="editor-inline-note"><CircleAlert size={16} aria-hidden="true" /> La visibilidad se confirma justo antes de publicar.</p>
          </section>

          <FormError message={error} />
          <div className="editor-actions">
            <Link className="secondary-button" to="/app/eventos" onClick={confirmLeave}>Cancelar</Link>
            {deleteAllowed && <button className="danger-button" type="button" disabled={saving} onClick={() => void remove()}>Eliminar evento</button>}
            <div className="editor-actions-primary"><button className="primary-button" disabled={saving || !draftValidation.valid}>{saving ? 'Guardando…' : form.status === 'published' ? 'Guardar cambios' : 'Guardar borrador'}</button>{form.status !== 'published' && !hasPast && <button className="secondary-button publish-action" type="button" disabled={saving} onClick={requestPublish}>Revisar y publicar <ChevronRight size={17} /></button>}</div>
          </div>
        </form>
        <aside className="editor-summary" aria-label="Resumen del evento">
          <div className="editor-summary-card">
            <div className="summary-card-heading"><span className={`status-label ${currentEvent?.status || 'draft'}`}>{statusLabel}</span>{dirty && <span className="unsaved-label">Cambios sin guardar</span>}</div>
            <h2>{form.title.trim() || 'Tu evento aparecerá aquí'}</h2>
            <p>{form.description.trim() || 'Completa la información para preparar una publicación clara.'}</p>
            <div className="summary-divider" />
            <div className="summary-progress"><div className="summary-progress-top"><span>Listo para publicar</span><strong>{publishReady ? '100%' : `${Math.max(0, 100 - publishMissingLabels.length * 14)}%`}</strong></div><div className="summary-progress-track"><span style={{ width: `${publishReady ? 100 : Math.max(8, 100 - publishMissingLabels.length * 14)}%` }} /></div></div>
            {!publishReady && <div className="summary-missing"><strong>Falta completar</strong><ul>{publishMissingLabels.slice(0, 4).map((label) => <li key={label}>{label}</li>)}</ul>{publishMissingLabels.length > 4 && <small>+{publishMissingLabels.length - 4} campos más</small>}</div>}
            <div className="summary-visibility"><span>{form.visibility === 'public' ? <Globe2 size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />} Visibilidad</span><strong>{form.visibility === 'public' ? 'Público' : 'Solo la red'}</strong></div>
            <button className="primary-button full" type="button" disabled={saving} onClick={requestPublish}>{publishReady ? 'Revisar publicación' : 'Ver qué falta'} <ChevronRight size={17} /></button>
          </div>
          <p className="editor-summary-help">Los borradores solo necesitan una comunidad y un título. Podrás completar el resto cuando quieras.</p>
        </aside>
      </div>
      <PublicationReviewModal open={publicationOpen} form={form} missingLabels={publishMissingLabels} ready={publishReady} visibility={publicationVisibility} onVisibilityChange={setPublicationVisibility} onClose={() => setPublicationOpen(false)} onConfirm={() => void confirmPublish()} saving={saving} />
    </div>
  )
}

function EditorProgressStep({ number, label, complete }: { number: string; label: string; complete: boolean }) {
  return <div className={`editor-progress-step ${complete ? 'complete' : ''}`}><span>{complete ? <Check size={14} aria-hidden="true" /> : number}</span><strong>{label}</strong></div>
}

function EditorSectionHeading({ number, icon, title, description }: { number: string; icon: ReactNode; title: string; description: string }) {
  return <div className="editor-section-heading"><div className="editor-section-title"><span className="editor-section-number">{number}</span><span className="editor-section-icon">{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div></div>
}

function ChoiceCard({ name, value, checked, onChange, icon, label, description }: { name: string; value: string; checked: boolean; onChange: () => void; icon: ReactNode; label: string; description: string }) {
  return <label className={`choice-card ${checked ? 'selected' : ''}`}><input type="radio" name={name} value={value} checked={checked} onChange={onChange} /><span className="choice-card-icon">{icon}</span><span><strong>{label}</strong><small>{description}</small></span><span className="choice-card-check" aria-hidden="true"><Check size={14} /></span></label>
}

function MapPinIcon() { return <MapPinned size={19} aria-hidden="true" /> }

function FieldError({ id, message }: { id: string; message?: string }) { return message ? <small className="field-error" id={id}>{message}</small> : null }

function PublicationReviewModal({ open, form, missingLabels, ready, visibility, onVisibilityChange, onClose, onConfirm, saving }: { open: boolean; form: EventInput; missingLabels: string[]; ready: boolean; visibility: EventInput['visibility']; onVisibilityChange: (visibility: EventInput['visibility']) => void; onClose: () => void; onConfirm: () => void; saving: boolean }) {
  if (!open) return null
  const reviewStart = toLimaIso(form.startsAt)
  const reviewEnd = toLimaIso(form.endsAt)
  const reviewLocation = form.locationType === 'online' ? 'Online' : form.venueName.trim() || form.address.trim() || 'Ubicación por completar'
  return <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="publication-modal" role="dialog" aria-modal="true" aria-labelledby="publication-review-title" aria-describedby="publication-review-description" onMouseDown={(event) => event.stopPropagation()}>
    <div className="publication-modal-heading"><div><span className="dashboard-kicker">Última revisión</span><h2 id="publication-review-title">Publicar evento</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
    <p className="muted-copy" id="publication-review-description">Confirma que la información esté correcta y decide quién podrá ver esta actividad.</p>
    <div className="publication-event-summary"><div><CalendarDays size={17} aria-hidden="true" /><span><strong>Evento</strong><small>{form.title.trim() || 'Título por completar'}</small></span></div><div><Clock3 size={17} aria-hidden="true" /><span><strong>Horario</strong><small>{formatDate(reviewStart)} · {formatTimeRange(reviewStart, reviewEnd)}</small></span></div><div><MapPinned size={17} aria-hidden="true" /><span><strong>Modalidad y lugar</strong><small>{form.locationType === 'hybrid' ? `Híbrido · ${reviewLocation}` : `${reviewLocation}`}</small></span></div></div>
    {ready ? <div className="publication-ready"><Check size={20} aria-hidden="true" /><span><strong>Todo listo para publicar</strong><small>{form.title || 'Este evento'} se mostrará con la visibilidad que elijas.</small></span></div> : <div className="publication-missing"><CircleAlert size={20} aria-hidden="true" /><div><strong>Aún faltan campos</strong><ul>{missingLabels.map((label) => <li key={label}>{label}</li>)}</ul><small>Vuelve al formulario para completar la información.</small></div></div>}
    <fieldset className="editor-choice-group publication-visibility"><legend>Visibilidad del evento</legend><div className="choice-grid choice-grid-two"><ChoiceCard name="publication-visibility" value="public" checked={visibility === 'public'} onChange={() => onVisibilityChange('public')} icon={<Globe2 size={19} aria-hidden="true" />} label="Público" description="Cualquier visitante podrá verlo" /><ChoiceCard name="publication-visibility" value="network" checked={visibility === 'network'} onChange={() => onVisibilityChange('network')} icon={<LockKeyhole size={19} aria-hidden="true" />} label="Solo la red" description="Solo usuarios autenticados" /></div></fieldset>
    <div className="publication-modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Volver a editar</button><button className="primary-button" type="button" disabled={!ready || saving} onClick={onConfirm}>{saving ? 'Publicando…' : visibility === 'public' ? 'Publicar como público' : 'Publicar solo para la red'}</button></div>
  </section></div>
}

function FieldLabel({ children, required }: { children: ReactNode; required: boolean }) {
  return <span className="field-label-row"><span>{children}</span><small className={required ? 'field-required' : 'field-optional'}>{required ? 'Obligatorio' : 'Opcional'}</small></span>
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

  useEffect(() => {
    if (!open) return
    setEmail('')
    setSelectedRole(inviteRole)
    setInviteUrl('')
    setMessage('')
    setError('')
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
    if (!supabase) { setError('Supabase no está configurado.'); return }
    if (!communityId) { setError('Selecciona una comunidad.'); return }
    const result = await supabase.functions.invoke('create-invitation', { body: { email, communityId, role: selectedRole } })
    if (result.error) setError(result.error.message)
    else { setInviteUrl(result.data?.inviteUrl || ''); setMessage('Invitación creada.'); setEmail('') }
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
        <div className="invite-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">Enviar invitación</button></div>
      </form>
    </section>
  </div>
}

function CommunityInviteForm({ community }: { community: Community }) {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const invite = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setInviteUrl('')
    setMessage('')
    if (!supabase) { setError('Supabase no está configurado.'); return }
    const result = await supabase.functions.invoke('create-invitation', { body: { email, communityId: community.id, role: 'community_editor' } })
    if (result.error) setError(result.error.message)
    else { setInviteUrl(result.data?.inviteUrl || ''); setMessage('Invitación creada.'); setEmail('') }
  }
  const copy = async () => { if (inviteUrl) await navigator.clipboard.writeText(inviteUrl) }
  return <section className="settings-section community-inline-invite-section">
    <h2>Invitar editor</h2>
    <p className="muted-copy">Ingresa el correo de la persona que tendrá permisos para crear y actualizar eventos de {community.name}.</p>
    <form className="invite-form community-inline-invite-form" onSubmit={(event) => void invite(event)}><label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@ejemplo.com" /></label><button className="primary-button" type="submit"><Mail size={16} /> Enviar invitación</button></form>
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
  const [memberEmails, setMemberEmails] = useState<string[]>([])
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberError, setMemberError] = useState('')
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
    setMemberEmails([])
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
    void listCommunityMemberEmails(communityId)
      .then((next) => { if (!cancelled) setMemberEmails(next) })
      .catch((reason: unknown) => { if (!cancelled) setMemberError(reason instanceof Error ? reason.message : 'No pudimos cargar los correos registrados.') })
      .finally(() => { if (!cancelled) setMemberLoading(false) })
    return () => { cancelled = true }
  }, [communityId])
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
        <div className="community-panel-heading"><div><h2>Correos registrados</h2><p className="muted-copy">Personas con acceso activo a esta comunidad.</p></div><span className="member-count" aria-label={`${memberEmails.length} correos registrados`}>{memberEmails.length}</span></div>
        {memberLoading && <LoadingState label="Cargando correos" />}
        {memberError && <FormError message={memberError} />}
        {!memberLoading && !memberError && (memberEmails.length ? <ul className="member-email-list">{memberEmails.map((memberEmail) => <li className="member-email-row" key={memberEmail}><Mail size={16} aria-hidden="true" /><a className="member-email-link" href={`mailto:${memberEmail}`}>{memberEmail}</a></li>)}</ul> : <div className="members-empty"><Mail size={24} aria-hidden="true" /><p>Aún no hay personas registradas en esta comunidad.</p></div>)}
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
