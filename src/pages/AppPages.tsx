import { Check, ChevronRight, Clipboard, Edit3, Mail, Plus, Shield, Users, X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { EmptyEvents, EventCard } from '../components/EventCard'
import { LoadingState } from '../components/Feedback'
import { archiveEvent, createCommunity, listCommunities, listEventReports, listManagedEvents, resolveEventReport, saveEvent, updateCommunity, updateCommunityStatus } from '../lib/data'
import { slugify } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Community, EventInput, EventItem, EventReport, Role } from '../types'

function PanelTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="panel-title"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function roleLabel(role: Role) {
  return { reader: 'Lector', community_editor: 'Editor de comunidad', community_admin: 'Administrador de comunidad', platform_admin: 'Administrador IGDA' }[role]
}

export function DashboardPage() {
  const { user, profile, memberships, roles, configured } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const manageable = memberships.filter((membership) => membership.role !== 'reader')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const isPlatformAdmin = roles.includes('platform_admin')
  useEffect(() => {
    void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then(setEvents).finally(() => setLoading(false))
  }, [manageableIds, isPlatformAdmin])
  const canManage = manageable.length > 0 || roles.includes('platform_admin')
  return <div className="dashboard-page"><PanelTitle title={`Hola${profile?.displayName ? `, ${profile.displayName}` : ''}`} description="Este es tu espacio para consultar y administrar la agenda." action={<Link className="primary-button" to={canManage ? '/app/eventos/nuevo' : '/'}><Plus size={17} /> {canManage ? 'Nuevo evento' : 'Volver a agenda'}</Link>} />{!configured && <div className="setup-panel"><Shield size={22} /><div><strong>Supabase aún no está conectado</strong><p>El panel está listo, pero necesitas configurar las variables de entorno para activar tus datos y permisos reales.</p></div></div>}<div className="dashboard-grid"><section className="dashboard-main"><div className="subheading"><h2>Tus eventos</h2>{canManage && <Link to="/app/eventos">Ver todos <ChevronRight size={17} /></Link>}</div>{loading ? <LoadingState label="Cargando tus eventos" /> : events.length ? <div className="event-list">{events.slice(0, 5).map((event) => <EventCard event={event} compact key={event.id} />)}</div> : <EmptyEvents authenticated />}</section><aside className="dashboard-sidebar"><h2>Tus comunidades</h2>{memberships.length ? <div className="membership-list">{memberships.map((membership) => <div className="membership-row" key={membership.communityId}><span className="membership-avatar"><Users size={18} /></span><span><strong>{membership.communityName}</strong><small>{roleLabel(membership.role)}</small></span></div>)}</div> : <p className="muted-copy">Aún no tienes permisos de gestión. Puedes seguir consultando los eventos de la red.</p>}{canManage && <Link className="secondary-button full" to="/app/comunidad">Gestionar comunidades</Link>}{roles.includes('platform_admin') && <Link className="secondary-button full" to="/app/admin">Administración IGDA</Link>}</aside></div>{user && <p className="account-caption">Sesión iniciada como {user.email}</p>}</div>
}

export function ManagedEventsPage() {
  const { memberships, roles } = useAuth()
  const manageable = memberships.filter((membership) => membership.role !== 'reader')
  const manageableIds = manageable.map((membership) => membership.communityId).join(',')
  const isPlatformAdmin = roles.includes('platform_admin')
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = () => { setLoading(true); void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then(setEvents).finally(() => setLoading(false)) }
  useEffect(load, [manageableIds, isPlatformAdmin])
  const archive = async (id: string) => { await archiveEvent(id); setMessage('Evento archivado.'); load() }
  return <div className="dashboard-page"><PanelTitle title="Tus eventos" description="Crea, publica y actualiza los eventos de tus comunidades." action={<Link className="primary-button" to="/app/eventos/nuevo"><Plus size={17} /> Nuevo evento</Link>} />{message && <p className="form-message success">{message}</p>}{loading ? <LoadingState label="Cargando eventos" /> : events.length ? <div className="managed-event-list">{events.map((event) => <div className="managed-event-row" key={event.id}><EventCard event={event} compact /><span className={`status-label ${event.status}`}>{event.status === 'published' ? 'Publicado' : event.status === 'draft' ? 'Borrador' : 'Archivado'}</span><div className="row-actions"><Link className="icon-button" to={`/app/eventos/${event.id}`} aria-label={`Editar ${event.title}`}><Edit3 size={17} /></Link>{event.status !== 'archived' && <button className="icon-button danger" type="button" onClick={() => void archive(event.id)} aria-label={`Archivar ${event.title}`}><X size={17} /></button>}</div></div>)}</div> : <EmptyEvents authenticated />}</div>
}

const emptyEvent: EventInput = { communityId: '', title: '', slug: '', description: '', type: 'CHARLA', startsAt: '', endsAt: '', locationType: 'venue', venueName: '', address: '', meetingUrl: '', visibility: 'public', status: 'draft' }

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
  useEffect(() => { if (!manageable.length && !isPlatformAdmin) { setLoading(false); return } void listManagedEvents(manageableIds ? manageableIds.split(',') : [], isPlatformAdmin).then((items) => { setManagedEvents(items); const item = items.find((event) => event.id === eventId); if (item) setForm({ communityId: item.communityId, title: item.title, slug: item.slug, description: item.description, type: item.type, startsAt: fromIso(item.startsAt), endsAt: fromIso(item.endsAt), locationType: item.locationType, venueName: item.venueName || '', address: item.address || '', meetingUrl: item.meetingUrl || '', visibility: item.visibility, status: item.status }) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar el evento.')).finally(() => setLoading(false)) }, [eventId, manageableIds, isPlatformAdmin])
  useEffect(() => { if (!eventId && !form.communityId && availableCommunities[0]) setForm((current) => ({ ...current, communityId: availableCommunities[0].id })) }, [eventId, form.communityId, availableCommunities])

  const update = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent | undefined, statusOverride?: EventInput['status']) => {
    event?.preventDefault(); setError('')
    const nextStatus = statusOverride || form.status
    if (!form.communityId || !form.title || !form.description || !form.startsAt || !form.endsAt) { setError('Completa comunidad, título, descripción, inicio y fin.'); return }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) { setError('La fecha de fin debe ser posterior al inicio.'); return }
    setSaving(true)
    try { await saveEvent({ ...form, status: nextStatus, slug: form.slug || slugify(form.title), startsAt: toLimaIso(form.startsAt), endsAt: toLimaIso(form.endsAt) }, currentEvent?.id); navigate('/app/eventos') } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el evento.') } finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Cargando editor" />
  return <div className="dashboard-page narrow-page"><PanelTitle title={eventId ? 'Editar evento' : 'Nuevo evento'} description="Los eventos de comunidades aprobadas pueden publicarse directamente." /><form className="editor-form" onSubmit={(event) => void submit(event)}><label>Comunidad<select required value={form.communityId} onChange={(event) => update('communityId', event.target.value)}><option value="">Selecciona una comunidad</option>{availableCommunities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label><div className="form-grid"><label>Título<input required value={form.title} onChange={(event) => { update('title', event.target.value); if (!eventId) update('slug', slugify(event.target.value)) }} /></label><label>Tipo<select value={form.type} onChange={(event) => update('type', event.target.value)}><option>CHARLA</option><option>TALLER</option><option>MEETUP</option><option>GAME JAM</option><option>CONFERENCIA</option></select></label></div><label>Descripción<textarea required rows={5} value={form.description} onChange={(event) => update('description', event.target.value)} /></label><div className="form-grid"><label>Inicio (hora de Lima)<input type="datetime-local" required value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></label><label>Fin (hora de Lima)<input type="datetime-local" required value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></label></div><div className="form-grid"><label>Modalidad<select value={form.locationType} onChange={(event) => update('locationType', event.target.value as EventInput['locationType'])}><option value="venue">Presencial</option><option value="online">Online</option><option value="hybrid">Híbrido</option></select></label><label>Visibilidad<select value={form.visibility} onChange={(event) => update('visibility', event.target.value as EventInput['visibility'])}><option value="public">Público</option><option value="network">Red autenticada</option></select></label></div><label>Lugar o nombre del venue<input value={form.venueName} onChange={(event) => update('venueName', event.target.value)} placeholder="Ej. Lima, Perú" /></label><label>Dirección<input value={form.address} onChange={(event) => update('address', event.target.value)} /></label><label>Enlace del evento<input type="url" value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="https://…" /></label><FormError message={error} /><div className="editor-actions"><Link className="secondary-button" to="/app/eventos">Cancelar</Link><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : form.status === 'published' ? 'Guardar cambios' : 'Guardar borrador'}</button>{form.status !== 'published' && <button className="secondary-button" type="button" disabled={saving} onClick={() => void submit(undefined, 'published')}>Publicar</button>}</div></form></div>
}

function FormError({ message }: { message: string }) { return message ? <p className="form-message error" role="alert">{message}</p> : null }

export function CommunitySettingsPage() {
  const { memberships, roles } = useAuth()
  const manageable = memberships.filter((membership) => membership.role === 'community_admin' || membership.role === 'platform_admin')
  const canInviteAdmins = roles.includes('platform_admin')
  const [community, setCommunity] = useState<Community | null>(null)
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'community_editor' | 'community_admin'>('community_editor')
  const [inviteUrl, setInviteUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (manageable[0]) void listCommunities(true).then((items) => { const item = items.find((communityItem) => communityItem.id === manageable[0].communityId); if (item) { setCommunity(item); setDescription(item.description) } }) }, [memberships])
  const save = async (event: FormEvent) => { event.preventDefault(); if (!community) return; setError(''); try { await updateCommunity(community.id, { description }); setMessage('Comunidad actualizada.') } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar la comunidad.') } }
  const invite = async (event: FormEvent) => { event.preventDefault(); setError(''); setInviteUrl(''); if (!supabase || !community) { setError('Supabase no está configurado.'); return } const result = await supabase.functions.invoke('create-invitation', { body: { email, communityId: community.id, role } }); if (result.error) setError(result.error.message); else { setInviteUrl(result.data?.inviteUrl || ''); setMessage('Invitación creada.'); setEmail('') } }
  const copy = async () => { if (inviteUrl) await navigator.clipboard.writeText(inviteUrl) }
  if (!community) return <div className="dashboard-page"><PanelTitle title="Comunidades" description="Aún no tienes una comunidad administrable." /></div>
  return <div className="dashboard-page narrow-page"><PanelTitle title={community.name} description="Gestiona la información pública y las personas con permisos." /><section className="settings-section"><h2>Información pública</h2><form className="editor-form" onSubmit={save}><label>Descripción<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label><FormError message={error} />{message && <p className="form-message success">{message}</p>}<button className="primary-button">Guardar cambios</button></form></section><section className="settings-section"><h2>Invitar a una persona</h2><p className="muted-copy">La persona recibirá un enlace de un solo uso para activar su acceso.</p><form className="invite-form" onSubmit={invite}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Rol<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="community_editor">Editor de comunidad</option>{canInviteAdmins && <option value="community_admin">Administrador de comunidad</option>}</select></label><button className="primary-button"><Mail size={16} /> Crear invitación</button></form>{inviteUrl && <div className="invite-result"><input readOnly value={inviteUrl} /><button className="icon-button" type="button" onClick={() => void copy()} aria-label="Copiar invitación"><Clipboard size={17} /></button></div>}</section></div>
}

export function PlatformAdminPage() {
  const { roles } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [reports, setReports] = useState<EventReport[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const load = () => { setLoading(true); void Promise.all([listCommunities(true), listEventReports()]).then(([nextCommunities, nextReports]) => { setCommunities(nextCommunities); setReports(nextReports) }).finally(() => setLoading(false)) }
  useEffect(load, [])
  if (!roles.includes('platform_admin')) return <div className="dashboard-page"><PanelTitle title="Sin acceso" description="Esta sección está reservada para administradores de IGDA Perú." /></div>
  const create = async (event: FormEvent) => { event.preventDefault(); if (!newName.trim()) return; try { await createCommunity(newName.trim(), slugify(newName)); setNewName(''); load() } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos crear la comunidad.') } }
  const moderate = async (community: Community, status: 'approved' | 'suspended') => { await updateCommunityStatus(community.id, status); load() }
  return <div className="dashboard-page"><PanelTitle title="Administración IGDA" description="Aprueba comunidades y conserva el control de la red." /><section className="admin-create"><form onSubmit={create}><input aria-label="Nombre de la nueva comunidad" placeholder="Nombre de la nueva comunidad" value={newName} onChange={(event) => setNewName(event.target.value)} /><button className="primary-button"><Plus size={16} /> Crear comunidad</button></form>{error && <FormError message={error} />}</section>{loading ? <LoadingState label="Cargando comunidades" /> : <><div className="admin-list">{communities.map((community) => <div className="admin-row" key={community.id}><div><strong>{community.name}</strong><small>{community.slug} · {community.status}</small></div><div className="row-actions">{community.status === 'pending' && <button className="secondary-button" type="button" onClick={() => void moderate(community, 'approved')}><Check size={16} /> Aprobar</button>}{community.status === 'approved' && <button className="icon-button danger" type="button" onClick={() => void moderate(community, 'suspended')} aria-label={`Suspender ${community.name}`}><X size={17} /></button>}{community.status === 'suspended' && <button className="secondary-button" type="button" onClick={() => void moderate(community, 'approved')}>Reactivar</button>}</div></div>)}</div><section className="settings-section admin-reports"><h2>Reportes pendientes</h2>{reports.length ? <div className="report-list">{reports.map((report) => <div className="report-row" key={report.id}><div><strong>{report.eventTitle}</strong><p>{report.reason}</p></div><button className="secondary-button" type="button" onClick={() => void resolveEventReport(report.id).then(load)}>Marcar revisado</button></div>)}</div> : <p className="muted-copy">No hay reportes pendientes.</p>}</section></>}</div>
}
