import { Archive, Check, ChevronRight, Clock3, LockKeyhole, MessageCircle, Plus, Send, Shield, X } from 'lucide-react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '../auth/useAuth'
import { CommunityLogo } from '../components/CommunityLogo'
import { ErrorState, LoadingState } from '../components/Feedback'
import { archiveConversation, createConversation, getConversationMessages, listCommunities, listConversations, markConversationRead, respondToConversation, sendMessage } from '../lib/data'
import { supabase } from '../lib/supabase'
import type { ChatIdentity, ChatMessage, Community, CommunityConversation, Membership } from '../types'

const igdaIdentity: ChatIdentity = { communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png' }

function formatChatDate(value?: string | null) {
  if (!value) return 'Sin mensajes todavía'
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)).replace('.', '')
}

function membershipIdentity(membership: Membership): ChatIdentity {
  return { communityId: membership.communityId, communityName: membership.communityName, communitySlug: membership.communitySlug, communityLogoPath: membership.communityLogoPath }
}

function conversationStatusLabel(conversation: CommunityConversation) {
  if (conversation.status === 'pending') return conversation.requestedByCommunityId === conversation.myCommunity.communityId ? 'Solicitud enviada' : 'Pendiente de respuesta'
  if (conversation.status === 'rejected') return 'Solicitud rechazada'
  return conversation.unreadCount ? `${conversation.unreadCount} sin leer` : 'Activa'
}

export function ConversationSummary({ canChat }: { canChat: boolean }) {
  const [conversations, setConversations] = useState<CommunityConversation[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canChat) return
    void listConversations().then(setConversations).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No pudimos cargar las conversaciones.'))
  }, [canChat])

  return <aside className="dashboard-chat-summary" aria-labelledby="dashboard-chat-title">
    <div className="chat-summary-heading"><div><span className="dashboard-kicker">Red IGDA</span><h2 id="dashboard-chat-title">Conversaciones</h2></div><MessageCircle size={20} aria-hidden="true" /></div>
    {!canChat ? <div className="chat-locked-note"><LockKeyhole size={18} aria-hidden="true" /><span>Solo los administradores y editores pueden conversar en nombre de una comunidad.</span></div> : error ? <p className="form-message error">{error}</p> : conversations.length ? <div className="chat-summary-list">{conversations.slice(0, 3).map((conversation) => <Link className={`chat-summary-row ${conversation.unreadCount ? 'unread' : ''}`} to={`/app/conversaciones?conversation=${conversation.id}`} key={conversation.id}><CommunityLogo path={conversation.otherCommunity.communityLogoPath} name={conversation.otherCommunity.communityName} size="small" decorative /><span><strong>{conversation.otherCommunity.communityName}</strong><small>{conversation.lastMessageBody || conversationStatusLabel(conversation)}</small></span><time>{formatChatDate(conversation.lastMessageAt)}</time>{conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}</Link>)}</div> : <p className="muted-copy">Aún no tienes conversaciones.</p>}
    {canChat && <Link className="chat-summary-link" to="/app/conversaciones">Ver todas las conversaciones <ChevronRight size={17} aria-hidden="true" /></Link>}
  </aside>
}

function ConversationList({ conversations, selectedId, onSelect }: { conversations: CommunityConversation[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <aside className="conversation-list" aria-label="Lista de conversaciones">
    <div className="conversation-list-heading"><div><span className="dashboard-kicker">Mensajería privada</span><h2>Conversaciones</h2></div><MessageCircle size={21} aria-hidden="true" /></div>
    {conversations.length ? <div className="conversation-list-items">{conversations.map((conversation) => <button className={`conversation-list-item ${selectedId === conversation.id ? 'selected' : ''} ${conversation.unreadCount ? 'unread' : ''}`} type="button" onClick={() => onSelect(conversation.id)} key={conversation.id}><CommunityLogo path={conversation.otherCommunity.communityLogoPath} name={conversation.otherCommunity.communityName} size="medium" decorative /><span><strong>{conversation.otherCommunity.communityName}</strong><small>{conversation.lastMessageBody || conversationStatusLabel(conversation)}</small><time>{formatChatDate(conversation.lastMessageAt)}</time></span>{conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}</button>)}</div> : <div className="chat-empty-list"><MessageCircle size={28} aria-hidden="true" /><p>Aún no hay conversaciones.</p><small>Escribe a otra comunidad para coordinar una actividad.</small></div>}
  </aside>
}

function NewConversationDialog({ open, identities, communities, onClose, onCreated }: { open: boolean; identities: ChatIdentity[]; communities: Community[]; onClose: () => void; onCreated: (conversationId: string) => void }) {
  const [sourceId, setSourceId] = useState(identities[0]?.communityId || '')
  const [targetId, setTargetId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSourceId(identities[0]?.communityId || '')
    setTargetId(communities.find((community) => !identities.some((identity) => identity.communityId === community.id || identity.communitySlug === community.slug))?.id || '')
    setError('')
  }, [communities, identities, open])

  if (!open) return null
  const targetOptions = communities.filter((community) => !identities.some((identity) => identity.communityId === community.id || identity.communitySlug === community.slug))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!sourceId || !targetId) { setError('Selecciona la comunidad que representarás y una comunidad destino.'); return }
    setSaving(true)
    setError('')
    try {
      const conversationId = await createConversation(targetId, sourceId)
      onCreated(conversationId)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos crear la solicitud.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="chat-new-modal" role="dialog" aria-modal="true" aria-labelledby="new-conversation-title" onMouseDown={(event) => event.stopPropagation()}>
    <div className="chat-modal-heading"><div><span className="dashboard-kicker">Coordinación</span><h2 id="new-conversation-title">Nueva conversación</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
    <p className="muted-copy">Envía una solicitud privada a otra comunidad. Solo un administrador de destino podrá aceptarla.</p>
    <form className="chat-new-form" onSubmit={(event) => void submit(event)}>
      <label><span>Representar a</span><select value={sourceId} onChange={(event) => setSourceId(event.target.value)} disabled={identities.length <= 1}>{identities.map((identity) => <option value={identity.communityId} key={identity.communityId}>{identity.communityName}</option>)}</select></label>
      <label><span>Comunidad destino</span><select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Selecciona una comunidad</option>{targetOptions.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label>
      {error && <p className="form-message error" role="alert">{error}</p>}
      <div className="chat-modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={saving || !targetOptions.length}>{saving ? 'Enviando…' : 'Enviar solicitud'} <ChevronRight size={17} aria-hidden="true" /></button></div>
    </form>
  </section></div>
}

function ChatThread({ conversation, canAccept, onChanged, onArchived }: { conversation: CommunityConversation | null; canAccept: boolean; onChanged: () => void; onArchived: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [responding, setResponding] = useState(false)
  const conversationId = conversation?.id || null
  const conversationStatus = conversation?.status || null

  const myCommunityId = conversation?.myCommunity.communityId || null

  useEffect(() => {
    let active = true
    if (!conversationId) { setMessages([]); setHasMore(false); return () => { active = false } }
    setLoading(true)
    setError('')
    void getConversationMessages(conversationId).then((items) => {
      if (!active) return
      setMessages(items)
      setHasMore(items.length === 50)
      if (myCommunityId) void markConversationRead(conversationId, myCommunityId)
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No pudimos cargar los mensajes.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [conversationId, myCommunityId])

  useEffect(() => {
    const client = supabase
    if (!client || !conversationId || conversationStatus !== 'active') return
    let active = true
    let channel: RealtimeChannel | null = null
    void client.realtime.setAuth().then(() => {
      if (!active) return
      channel = client.channel(`community-conversation:${conversationId}`, { config: { private: true } }).on('broadcast', { event: 'INSERT' }, () => {
        void getConversationMessages(conversationId).then((items) => { if (active) setMessages(items) })
        onChanged()
      }).subscribe()
    })
    return () => { active = false; if (channel) void client.removeChannel(channel) }
  }, [conversationId, conversationStatus, onChanged])

  if (!conversation) return <section className="chat-thread chat-thread-empty"><MessageCircle size={34} aria-hidden="true" /><h2>Selecciona una conversación</h2><p>Elige una conversación de la lista o inicia una nueva con otra comunidad.</p></section>

  const isIncoming = conversation.requestedByCommunityId !== conversation.myCommunity.communityId
  const loadOlder = async () => {
    const cursor = messages[0]?.createdAt
    if (!conversationId || !cursor || loadingOlder || !hasMore) return
    setLoadingOlder(true)
    setError('')
    try {
      const older = await getConversationMessages(conversationId, cursor)
      setMessages((current) => [...older.filter((item) => !current.some((existing) => existing.id === item.id)), ...current])
      setHasMore(older.length === 50)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos cargar mensajes anteriores.')
    } finally {
      setLoadingOlder(false)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const message = await sendMessage(conversation.id, conversation.myCommunity.communityId, body)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      setDraft('')
      void markConversationRead(conversation.id, conversation.myCommunity.communityId)
      onChanged()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }
  const respond = async (accept: boolean) => {
    setResponding(true)
    setError('')
    try { await respondToConversation(conversation.id, accept); onChanged() } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos actualizar la solicitud.') } finally { setResponding(false) }
  }
  const archive = async () => {
    try { await archiveConversation(conversation.id, conversation.myCommunity.communityId); onArchived() } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'No pudimos archivar la conversación.') }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
  }

  return <section className="chat-thread" aria-labelledby="chat-thread-title">
    <header className="chat-thread-header"><div className="chat-thread-identity"><CommunityLogo path={conversation.otherCommunity.communityLogoPath} name={conversation.otherCommunity.communityName} size="large" decorative /><div><span className="dashboard-kicker">Conversación privada</span><h2 id="chat-thread-title">{conversation.otherCommunity.communityName}</h2><small>{conversationStatusLabel(conversation)}</small></div></div>{conversation.status === 'active' && <button className="secondary-button compact-button" type="button" onClick={() => void archive()}><Archive size={16} aria-hidden="true" /> Archivar</button>}</header>
    <div className="chat-privacy-note"><LockKeyhole size={16} aria-hidden="true" /><span>Solo los miembros autorizados de ambas comunidades pueden ver esta conversación.</span></div>
    {conversation.status === 'pending' && <div className={`chat-request-state ${isIncoming ? 'incoming' : 'outgoing'}`}><Clock3 size={18} aria-hidden="true" /><div><strong>{isIncoming ? `${conversation.otherCommunity.communityName} quiere conversar contigo` : 'Solicitud enviada'}</strong><p>{isIncoming ? 'Un administrador puede aceptar o rechazar esta conversación.' : 'La comunidad destino debe aceptar antes de que puedan enviarse mensajes.'}</p>{isIncoming && canAccept && <div className="chat-request-actions"><button className="primary-button" type="button" disabled={responding} onClick={() => void respond(true)}><Check size={16} aria-hidden="true" /> Aceptar</button><button className="secondary-button" type="button" disabled={responding} onClick={() => void respond(false)}>Rechazar</button></div>}</div></div>}
    {conversation.status === 'rejected' && <div className="chat-request-state rejected"><Shield size={18} aria-hidden="true" /><div><strong>Solicitud rechazada</strong><p>Puedes iniciar una nueva solicitud más adelante si necesitas coordinar con esta comunidad.</p></div></div>}
    {conversation.status === 'active' && <>{loading ? <LoadingState label="Cargando mensajes" /> : <div className="chat-messages" aria-live="polite">{hasMore && <button className="chat-load-more" type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores'}</button>}{messages.length ? messages.map((message) => { const mine = message.authorCommunity.communityId === conversation.myCommunity.communityId; return <article className={`chat-message ${mine ? 'mine' : 'theirs'}`} key={message.id}><div className="chat-message-author"><CommunityLogo path={message.authorCommunity.communityLogoPath} name={message.authorCommunity.communityName} size="small" decorative /><span><strong>{message.authorDisplayName}</strong><small>{message.authorCommunity.communityName} · {formatChatDate(message.createdAt)}</small></span></div><p>{message.body}</p></article> }) : <div className="chat-empty-messages"><MessageCircle size={28} aria-hidden="true" /><p>Aún no hay mensajes.</p><small>Escribe para iniciar la coordinación.</small></div>}</div>}{error && <p className="form-message error" role="alert">{error}</p>}<form className="chat-composer" onSubmit={(event) => void submit(event)}><textarea value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe un mensaje…" aria-label="Mensaje" rows={2} /><div className="chat-composer-bottom"><small>{draft.length}/2000 · Enter para enviar</small><button className="primary-button" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Enviando…' : 'Enviar'} <Send size={16} aria-hidden="true" /></button></div></form></>}
  </section>
}

export function ConversationsPage() {
  const { memberships, roles } = useAuth()
  const [searchParams] = useSearchParams()
  const isPlatformAdmin = roles.includes('platform_admin')
  const manageable = useMemo(() => memberships.filter((membership) => membership.communityId && membership.role !== 'reader'), [memberships])
  const identities = useMemo(() => isPlatformAdmin ? [igdaIdentity] : manageable.map(membershipIdentity), [isPlatformAdmin, manageable])
  const canChat = identities.length > 0
  const [conversations, setConversations] = useState<CommunityConversation[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newConversationOpen, setNewConversationOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const requestedConversationId = searchParams.get('conversation')
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) || null
  const selectedRole = selectedConversation ? memberships.find((membership) => membership.communityId === selectedConversation.myCommunity.communityId)?.role : undefined
  const canAccept = Boolean(selectedConversation && selectedConversation.requestedByCommunityId !== selectedConversation.myCommunity.communityId && (isPlatformAdmin || selectedRole === 'community_admin'))

  useEffect(() => {
    if (!canChat) { setLoading(false); return }
    let active = true
    setLoading(true)
    setError('')
    void Promise.all([listConversations(), listCommunities()]).then(([nextConversations, nextCommunities]) => {
      if (!active) return
      setConversations(nextConversations)
      setCommunities(nextCommunities)
      setSelectedId((current) => requestedConversationId && nextConversations.some((conversation) => conversation.id === requestedConversationId) ? requestedConversationId : current && nextConversations.some((conversation) => conversation.id === current) ? current : nextConversations[0]?.id || null)
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No pudimos cargar las conversaciones.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [canChat, reloadToken, requestedConversationId])

  const reload = useCallback(() => setReloadToken((current) => current + 1), [])
  const handleCreated = (conversationId: string) => { setNewConversationOpen(false); setSelectedId(conversationId); reload() }
  const handleArchived = () => { setSelectedId(null); reload() }

  return <div className="dashboard-page conversations-page">
    <div className="panel-title"><div><h1>Conversaciones</h1><p>Coordina actividades directamente con otras comunidades de la red.</p></div>{canChat && <button className="primary-button" type="button" onClick={() => setNewConversationOpen(true)}><Plus size={17} aria-hidden="true" /> Nueva conversación</button>}</div>
    {!canChat ? <div className="chat-access-block"><LockKeyhole size={27} aria-hidden="true" /><h2>Conversaciones entre comunidades</h2><p>Necesitas ser administrador o editor de una comunidad para iniciar y responder conversaciones.</p></div> : error ? <ErrorState message={error} /> : loading ? <LoadingState label="Cargando conversaciones" /> : <div className="chat-workspace"><ConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} /><ChatThread conversation={selectedConversation} canAccept={canAccept} onChanged={reload} onArchived={handleArchived} /></div>}
    <NewConversationDialog open={newConversationOpen} identities={identities} communities={communities} onClose={() => setNewConversationOpen(false)} onCreated={handleCreated} />
  </div>
}
