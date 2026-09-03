import { Check, ChevronRight, Clipboard, Mail, Plus, RefreshCw, Shield, Users, X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EmptyEvents, EventCard } from '../components/EventCard'
import { LoadingState } from '../components/Feedback'
import { archiveEvent, createCommunity, deleteEvent, listCommunities, listEventReports, listManagedEvents, resolveEventReport, saveEvent, syncCommunitiesFromSheet, updateCommunity, updateCommunityStatus } from '../lib/data'
import { isEventPast, slugify } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Community, CommunitySyncResult, EventInput, EventItem, EventReport, Membership, Role } from '../types'

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
          {memberships.length ? <div className="membership-list">{memberships.map((membership) => <div className="membership-row" key={membership.communityId}><span className="membership-avatar"><Users size={18} /></span><span><strong>{membership.communityName}</strong><small>{roleLabel(membership.role)}</small></span></div>)}</div> : <p className="muted-copy">Aún no tienes permisos de gestión. Puedes seguir consultando los eventos de la red.</p>}
          {canManage && <Link className="secondary-button full" to="/app/comunidad">Gestionar comunidades</Link>}
          {roles.includes('platform_admin') && <Link className="secondary-button full" to="/app/admin">Administración IGDA</Link>}
        </aside>
        <section className="dashboard-main">
          <div className="dashboard-panel-heading"><h2>Tus eventos</h2><div className="dashboard-panel-actions">{canManage && <Link className="primary-button" to="/app/eventos/nuevo"><Plus size={17} /> Nuevo evento</Link>}{canManage && <Link className="subheading-link" to="/app/eventos">Ver todos <ChevronRight size={17} /></Link>}</div></div>
          {message && <p className="form-message success">{message}</p>}
          {actionError && <p className="form-message error">{actionError}</p>}
          {loading ? <LoadingState label="Cargando tus eventos" /> : events.length ? <div className="event-list">{events.slice(0, 5).map((event) => <EventCard event={event} compact panelActions={{ onArchive: () => void archive(event), onDelete: () => void remove(event), canDelete: canDeleteEvent(event, memberships, isPlatformAdmin) }} key={event.id} />)}</div> : <EmptyEvents authenticated />}
        </section>
      </div>
      {user && <p className="account-caption">Sesión iniciada como {user.email}</p>}
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

const emptyEvent: EventInput = { communityId: '', title: '', slug: '', description: '', type: 'CHARLA', startsAt: '', endsAt: '', locationType: 'venue', venueName: '', address: '', mapUrl: '', meetingUrl: '', meetingProvider: 'other', visibility: 'public', status: 'draft' }

function toLimaIso(value: string) { return value ? new Date(`${value}:00-05:00`).toISOString() : '' }
function fromIso(value: string) { if (!value) return ''; const date = new Date(value); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).reduce<Record<string, string>>((acc, part) => { acc[part.type] = part.value; return acc }, {}); return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` }

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
  const currentEvent = managedEvents.find((event) => event.id === eventId)

  useEffect(() => { if (isPlatformAdmin) void listCommunities(true).then(setAvailableCommunities); else setAvailableCommunities(manageable.map((membership) => ({ id: membership.communityId, slug: membership.communitySlug, name: membership.communityName, description: '', status: 'approved' }))) }, [isPlatformAdmin, manageableIds])
  useEffect(() => { if (!manageable.length && !isPlatformAdmin) { setLoading(false); return } void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then((items) => { setManagedEvents(items); const item = items.find((event) => event.id === eventId); if (item) setForm({ communityId: item.communityId, title: item.title, slug: item.slug, description: item.description, type: item.type, startsAt: fromIso(item.startsAt), endsAt: fromIso(item.endsAt), locationType: item.locationType, venueName: item.venueName || '', address: item.address || '', mapUrl: item.mapUrl || '', meetingUrl: item.meetingUrl || '', meetingProvider: item.meetingProvider || 'other', visibility: item.visibility, status: item.status }) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar el evento.')).finally(() => setLoading(false)) }, [eventId, manageableIds, isPlatformAdmin])
  useEffect(() => { if (!eventId && !form.communityId && availableCommunities[0]) setForm((current) => ({ ...current, communityId: availableCommunities[0].id })) }, [eventId, form.communityId, availableCommunities])

  const update = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const needsMeetingLink = form.locationType !== 'venue'
  const needsPhysicalLocation = form.locationType !== 'online'
  const hasPast = currentEvent ? isEventPast(currentEvent) : false
  const deleteAllowed = currentEvent ? canDeleteEvent(currentEvent, memberships, isPlatformAdmin) : false

  const openMapsSearch = () => {
    const query = [form.venueName, form.address].map((value) => value.trim()).filter(Boolean).join(', ')
    if (!query) {
      setError('Escribe el nombre del lugar o la dirección para buscarlo en Google Maps.')
      return
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
  }

  const submit = async (event: FormEvent | undefined, statusOverride?: EventInput['status']) => {
    event?.preventDefault(); setError('')
    const nextStatus = statusOverride || form.status
    if (!form.communityId || !form.title.trim() || !form.description.trim() || !form.startsAt || !form.endsAt) { setError('Completa los campos marcados como obligatorios.'); return }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) { setError('La fecha de fin debe ser posterior al inicio.'); return }
    if (needsPhysicalLocation && !form.venueName.trim() && !form.address.trim()) { setError('Añade el nombre del lugar o una dirección para el evento presencial.'); return }
    if (needsMeetingLink && !form.meetingUrl.trim()) { setError('Añade el enlace de Zoom o Google Meet para este evento.'); return }
    if (form.meetingUrl.trim() && !isHttpUrl(form.meetingUrl)) { setError('El enlace de acceso debe comenzar con http:// o https://.'); return }
    if (form.mapUrl.trim() && !isHttpUrl(form.mapUrl)) { setError('El enlace de Google Maps debe comenzar con http:// o https://.'); return }
    setSaving(true)
    try { await saveEvent({ ...form, status: nextStatus, slug: form.slug || slugify(form.title), startsAt: toLimaIso(form.startsAt), endsAt: toLimaIso(form.endsAt) }, currentEvent?.id); navigate('/app/eventos') } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el evento.') } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!currentEvent || !deleteAllowed || !window.confirm(`¿Eliminar “${currentEvent.title}”? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    setError('')
    try { await deleteEvent(currentEvent.id); navigate('/app/eventos') } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos eliminar el evento.') } finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Cargando editor" />
  return (
    <div className="dashboard-page event-editor-page">
      <div className="event-editor-heading">
        <div>
          <Link className="back-link" to="/app/eventos"><ChevronRight size={18} className="back-icon" /> Tus eventos</Link>
          <h1>{eventId ? 'Editar evento' : 'Crear nuevo evento'}</h1>
        </div>
        {currentEvent && <span className={`status-label ${currentEvent.status}`}>{hasPast ? 'Ya pasó' : currentEvent.status === 'published' ? 'Publicado' : currentEvent.status === 'draft' ? 'Borrador' : 'Archivado'}</span>}
      </div>
      <form className="event-editor-card" onSubmit={(event) => void submit(event)}>
        <section className="editor-section">
          <div className="editor-section-heading"><div><h2>Información principal</h2><p>Una descripción clara ayuda a que más personas entiendan la actividad.</p></div></div>
          <div className="form-grid">
            <label className="editor-field"><FieldLabel required>Comunidad</FieldLabel><select required value={form.communityId} onChange={(event) => update('communityId', event.target.value)}><option value="">Selecciona una comunidad</option>{availableCommunities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label>
            <label className="editor-field"><FieldLabel required>Título del evento</FieldLabel><input required value={form.title} onChange={(event) => { update('title', event.target.value); if (!eventId) update('slug', slugify(event.target.value)) }} placeholder="Ej. Meetup de desarrollo indie" /></label>
          </div>
          <div className="form-grid">
            <label className="editor-field"><FieldLabel required={false}>Tipo de actividad</FieldLabel><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>CHARLA</option><option>TALLER</option><option>MEETUP</option><option>GAME JAM</option><option>CONFERENCIA</option></select></label>
            <div className="field-spacer" aria-hidden="true" />
          </div>
          <label className="editor-field"><FieldLabel required>Descripción</FieldLabel><textarea required rows={5} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Cuenta qué aprenderán o encontrarán las personas asistentes." /><small className="field-help">Puedes incluir agenda, público objetivo o requisitos.</small></label>
        </section>

        <section className="editor-section">
          <div className="editor-section-heading"><div><h2>Fecha y hora</h2><p>Se guardará con la zona horaria de Lima y se mostrará así a las personas asistentes.</p></div></div>
          <div className="form-grid">
            <label className="editor-field"><FieldLabel required>Inicio · hora de Lima</FieldLabel><input type="datetime-local" required value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></label>
            <label className="editor-field"><FieldLabel required>Fin · hora de Lima</FieldLabel><input type="datetime-local" required value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></label>
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section-heading"><div><h2>Ubicación y acceso</h2><p>Combina un lugar físico con una llamada o agrega solo la opción online.</p></div></div>
          <label className="editor-field"><FieldLabel required>Modalidad</FieldLabel><select value={form.locationType} onChange={(event) => update('locationType', event.target.value as EventInput['locationType'])}><option value="venue">Presencial</option><option value="online">Online</option><option value="hybrid">Híbrido</option></select></label>
          {needsPhysicalLocation && <>
            <div className="form-grid">
              <label className="editor-field"><FieldLabel required={false}>Nombre del lugar</FieldLabel><input value={form.venueName} onChange={(event) => update('venueName', event.target.value)} placeholder="Ej. Casa Cultural, Lima" /></label>
              <label className="editor-field"><FieldLabel required={false}>Dirección</FieldLabel><input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Av. / calle, distrito, ciudad" /></label>
            </div>
            <div className="location-tools"><p className="field-help">Completa al menos el nombre del lugar o la dirección. Puedes buscar una ubicación en Google Maps y pegar su enlace.</p><button className="secondary-button" type="button" onClick={openMapsSearch}>Buscar en Google Maps</button></div>
            <label className="editor-field"><FieldLabel required={false}>Enlace de Google Maps</FieldLabel><input type="url" value={form.mapUrl} onChange={(event) => update('mapUrl', event.target.value)} placeholder="https://maps.google.com/…" /></label>
          </>}
          <div className="access-fields">
            <label className="editor-field"><FieldLabel required={needsMeetingLink}>Plataforma de llamada</FieldLabel><select value={form.meetingProvider} onChange={(event) => update('meetingProvider', event.target.value as EventInput['meetingProvider'])}><option value="zoom">Zoom</option><option value="google_meet">Google Meet</option><option value="other">Otra plataforma</option></select></label>
            <label className="editor-field"><FieldLabel required={needsMeetingLink}>Enlace para unirse</FieldLabel><input type="url" required={needsMeetingLink} value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="https://…" /><small className="field-help">{needsMeetingLink ? 'Es obligatorio para eventos online e híbridos.' : 'Opcional para eventos presenciales.'}</small></label>
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section-heading"><div><h2>Publicación</h2><p>Elige quién puede encontrar este evento en la agenda.</p></div></div>
          <label className="editor-field"><FieldLabel required>Visibilidad</FieldLabel><select value={form.visibility} onChange={(event) => update('visibility', event.target.value as EventInput['visibility'])}><option value="public">Público · cualquier visitante</option><option value="network">Privado · usuarios autenticados</option></select><small className="field-help">Los eventos privados nunca aparecen en la agenda pública ni en el embed.</small></label>
        </section>

        <FormError message={error} />
        <div className="editor-actions">
          <Link className="secondary-button" to="/app/eventos">Cancelar</Link>
          {deleteAllowed && <button className="danger-button" type="button" disabled={saving} onClick={() => void remove()}>Eliminar evento</button>}
          <div className="editor-actions-primary"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : form.status === 'published' ? 'Guardar cambios' : 'Guardar borrador'}</button>{form.status !== 'published' && !hasPast && <button className="secondary-button" type="button" disabled={saving} onClick={() => void submit(undefined, 'published')}>Publicar</button>}</div>
        </div>
      </form>
    </div>
  )
}

function FieldLabel({ children, required }: { children: ReactNode; required: boolean }) {
  return <span className="field-label-row"><span>{children}</span><small className={required ? 'field-required' : 'field-optional'}>{required ? 'Obligatorio' : 'Opcional'}</small></span>
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function FormError({ message }: { message: string }) { return message ? <p className="form-message error" role="alert">{message}</p> : null }

export function CommunitySettingsPage() {
  const { memberships, roles } = useAuth()
  const isPlatformAdmin = roles.includes('platform_admin')
  const manageable = memberships.filter((membership) => membership.role === 'community_admin' || membership.role === 'platform_admin')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const [communities, setCommunities] = useState<Community[]>([])
  const [communityId, setCommunityId] = useState('')
  const [community, setCommunity] = useState<Community | null>(null)
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'community_editor' | 'community_admin'>('community_editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
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
    setDescription(selected?.description || '')
    setInviteUrl('')
    setMessage('')
    setError('')
  }, [communityId, communities])
  const save = async (event: FormEvent) => { event.preventDefault(); if (!community) return; setError(''); try { await updateCommunity(community.id, { description }); setMessage('Comunidad actualizada.') } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar la comunidad.') } }
  const invite = async (event: FormEvent) => { event.preventDefault(); setError(''); setInviteUrl(''); if (!supabase || !community) { setError('Supabase no está configurado.'); return } const result = await supabase.functions.invoke('create-invitation', { body: { email, communityId: community.id, role } }); if (result.error) setError(result.error.message); else { setInviteUrl(result.data?.inviteUrl || ''); setMessage('Invitación creada.'); setEmail('') } }
  const copy = async () => { if (inviteUrl) await navigator.clipboard.writeText(inviteUrl) }
  if (!communities.length) return <div className="dashboard-page"><PanelTitle title="Comunidades" description={isPlatformAdmin ? 'Aprueba una comunidad antes de invitar a su primer administrador.' : 'Aún no tienes una comunidad administrable.'} /></div>
  if (!community) return <LoadingState label="Cargando comunidad" />
  return <div className="dashboard-page narrow-page"><PanelTitle title={community.name} description="Gestiona la información pública y las personas con permisos." />{isPlatformAdmin && <label className="community-selector">Comunidad<select value={communityId} onChange={(event) => setCommunityId(event.target.value)}>{communities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}<section className="settings-section"><h2>Información pública</h2><form className="editor-form" onSubmit={save}><label>Descripción<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label><FormError message={error} />{message && <p className="form-message success">{message}</p>}<button className="primary-button">Guardar cambios</button></form></section><section className="settings-section"><h2>Invitar a una persona</h2><p className="muted-copy">La persona recibirá un enlace de un solo uso para activar su acceso.</p><form className="invite-form" onSubmit={invite}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Rol<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="community_editor">Editor de comunidad</option>{isPlatformAdmin && <option value="community_admin">Administrador de comunidad</option>}</select></label><button className="primary-button"><Mail size={16} /> Crear invitación</button></form>{inviteUrl && <div className="invite-result"><input readOnly value={inviteUrl} /><button className="icon-button" type="button" onClick={() => void copy()} aria-label="Copiar invitación"><Clipboard size={17} /></button></div>}</section></div>
}

export function PlatformAdminPage() {
  const { roles } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [reports, setReports] = useState<EventReport[]>([])
  const [syncResult, setSyncResult] = useState<CommunitySyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
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
  return <div className="dashboard-page"><PanelTitle title="Administración IGDA" description="Aprueba comunidades y conserva el control de la red." /><section className="admin-create"><form onSubmit={create}><input aria-label="Nombre de la nueva comunidad" placeholder="Nombre de la nueva comunidad" value={newName} onChange={(event) => setNewName(event.target.value)} /><button className="primary-button"><Plus size={16} /> Crear comunidad</button></form>{error && <FormError message={error} />}</section><section className="settings-section admin-sync"><div className="sync-heading"><div><h2>Actualizar desde Google Sheets</h2><p className="muted-copy">Importa manualmente la pestaña <strong>TO NOTION</strong>. Solo se procesan filas con <strong>VALIDACIÓN</strong> activa.</p></div><button className="primary-button" type="button" onClick={() => void sync()} disabled={syncing}><RefreshCw size={16} className={syncing ? 'spin' : ''} /> {syncing ? 'Actualizando…' : 'Actualizar comunidades'}</button></div><p className="muted-copy">Las comunidades nuevas quedan aprobadas. El estado de una comunidad existente, incluida una suspensión, se conserva en esta aplicación.</p>{syncError && <FormError message={syncError} />}{syncResult && <div className="sync-result" role="status"><strong>Actualización completada</strong><span>{syncResult.created} creadas · {syncResult.updated} actualizadas · {syncResult.skipped} omitidas</span>{syncResult.skippedRows.length > 0 && <details><summary>Ver filas omitidas</summary><ul>{syncResult.skippedRows.map((row, index) => <li key={`${row.sourceId || 'row'}-${row.row}-${index}`}>{row.name || row.sourceId || `Fila ${row.row}`}: {row.reason}</li>)}</ul></details>}</div>}</section>{loading ? <LoadingState label="Cargando comunidades" /> : <><div className="admin-list">{communities.map((community) => <div className="admin-row" key={community.id}><div><strong>{community.name}</strong><small>{community.slug} · {community.status}</small></div><div className="row-actions">{community.status === 'pending' && <button className="secondary-button" type="button" onClick={() => void moderate(community, 'approved')}><Check size={16} /> Aprobar</button>}{community.status === 'approved' && <button className="icon-button danger" type="button" onClick={() => void moderate(community, 'suspended')} aria-label={`Suspender ${community.name}`}><X size={17} /></button>}{community.status === 'suspended' && <button className="secondary-button" type="button" onClick={() => void moderate(community, 'approved')}>Reactivar</button>}</div></div>)}</div><section className="settings-section admin-reports"><h2>Reportes pendientes</h2>{reports.length ? <div className="report-list">{reports.map((report) => <div className="report-row" key={report.id}><div><strong>{report.eventTitle}</strong><p>{report.reason}</p></div><button className="secondary-button" type="button" onClick={() => void resolveEventReport(report.id).then(load)}>Marcar revisado</button></div>)}</div> : <p className="muted-copy">No hay reportes pendientes.</p>}</section></>}</div>
}
