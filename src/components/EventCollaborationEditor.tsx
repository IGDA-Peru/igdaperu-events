import { Plus, Trash2, Users } from 'lucide-react'
import type { Community, EventCollaborator, ExternalEventCollaboratorInput } from '../types'
import { CommunityLogo } from './CommunityLogo'
import './EventCollaborators.css'

export function EventCollaborationEditor({
  hostCommunityId,
  registeredInvitesAllowed = true,
  communities,
  communityIds,
  externalCollaborators,
  collaborators = [],
  onCommunityIdsChange,
  onExternalCollaboratorsChange,
}: {
  hostCommunityId: string | null
  registeredInvitesAllowed?: boolean
  communities: Community[]
  communityIds: string[]
  externalCollaborators: ExternalEventCollaboratorInput[]
  collaborators?: EventCollaborator[]
  onCommunityIdsChange: (value: string[]) => void
  onExternalCollaboratorsChange: (value: ExternalEventCollaboratorInput[]) => void
}) {
  const options = communities.filter((community) => community.status === 'approved' && community.id !== hostCommunityId)
  const collaboratorByCommunityId = new Map(collaborators.filter((collaborator) => collaborator.kind === 'community' && collaborator.communityId).map((collaborator) => [collaborator.communityId as string, collaborator]))

  const toggleCommunity = (communityId: string, checked: boolean) => {
    onCommunityIdsChange(checked
      ? [...new Set([...communityIds, communityId])]
      : communityIds.filter((id) => id !== communityId))
  }

  const updateExternal = (index: number, field: 'name' | 'contactUrl', value: string) => {
    onExternalCollaboratorsChange(externalCollaborators.map((collaborator, currentIndex) => currentIndex === index ? { ...collaborator, [field]: value } : collaborator))
  }

  const addExternal = () => onExternalCollaboratorsChange([...externalCollaborators, { id: crypto.randomUUID(), name: '', contactUrl: '' }])
  const removeExternal = (index: number) => onExternalCollaboratorsChange(externalCollaborators.filter((_, currentIndex) => currentIndex !== index))

  return <div className="event-collaboration-editor">
    <p>Invita a comunidades registradas desde sus conversaciones. La colaboración aparecerá públicamente cuando la acepten. Las comunidades externas ya autorizadas se agregan manualmente y aparecerán de inmediato.</p>
    <section className="event-collaboration-section" aria-labelledby="event-collaboration-communities-title">
      <div className="event-banner-heading"><div><strong id="event-collaboration-communities-title"><Users size={17} aria-hidden="true" /> Comunidades de la plataforma</strong><p>La persona administradora de cada comunidad recibirá una invitación en su conversación.</p></div></div>
      {!hostCommunityId && <p className="editor-inline-note">Los eventos independientes no pueden invitar comunidades registradas. Puedes agregar colaboradores externos.</p>}
      {hostCommunityId && !registeredInvitesAllowed && <p className="editor-inline-note">Las invitaciones deben enviarse desde una comunidad que representes en las conversaciones.</p>}
      {hostCommunityId && registeredInvitesAllowed && (options.length ? <div className="event-collaboration-community-list">{options.map((community) => <label className="event-collaboration-community" key={community.id}>
        <input type="checkbox" checked={communityIds.includes(community.id)} onChange={(event) => toggleCommunity(community.id, event.target.checked)} />
        <CommunityLogo path={community.logoPath} name={community.name} color={community.brandColor} size="small" decorative />
        <span><strong>{community.name}</strong><small>{collaboratorByCommunityId.get(community.id)?.status === 'accepted' ? 'Colaboración aceptada' : collaboratorByCommunityId.get(community.id)?.status === 'rejected' ? 'Invitación rechazada · quita y vuelve a seleccionar para reenviar' : collaboratorByCommunityId.has(community.id) ? 'Invitación pendiente' : 'Invitación con aceptación requerida'}</small></span>
      </label>)}</div> : <p className="editor-inline-note">No hay otras comunidades aprobadas para invitar.</p>)}
    </section>
    <section className="event-collaboration-section" aria-labelledby="event-collaboration-external-title">
      <div className="event-banner-heading"><div><strong id="event-collaboration-external-title">Comunidades externas</strong><p>Ingresa los datos de comunidades que ya confirmaron su participación.</p></div><button className="secondary-button event-banner-action" type="button" onClick={addExternal}><Plus size={16} aria-hidden="true" /> Agregar externa</button></div>
      {externalCollaborators.length > 0 && <div className="event-collaboration-external">{externalCollaborators.map((collaborator, index) => <div className="event-collaboration-external-row" key={collaborator.id || `external-${index}`}>
        <label>Nombre de la comunidad<input type="text" required minLength={2} maxLength={120} value={collaborator.name} onChange={(event) => updateExternal(index, 'name', event.target.value)} placeholder="Ej. Comunidad indie local" /></label>
        <label>Enlace de contacto<input type="url" required pattern="https?://.+" value={collaborator.contactUrl} onChange={(event) => updateExternal(index, 'contactUrl', event.target.value)} placeholder="https://…" /></label>
        <button className="event-collaboration-remove" type="button" aria-label={`Quitar ${collaborator.name || 'comunidad externa'}`} onClick={() => removeExternal(index)}><Trash2 size={16} aria-hidden="true" /> Quitar</button>
      </div>)}</div>}
    </section>
  </div>
}
