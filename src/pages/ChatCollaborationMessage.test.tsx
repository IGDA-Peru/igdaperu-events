import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventCollaborationMessage } from './ChatPage'
import type { ChatMessage } from '../types'

const message: ChatMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  authorUserId: 'host-user',
  authorCommunity: { communityId: 'host', communityName: 'Comunidad anfitriona', communitySlug: 'host' },
  authorDisplayName: 'Persona anfitriona',
  body: 'Te invitamos a colaborar.',
  createdAt: '2026-09-01T12:00:00Z',
  kind: 'event_collaboration',
  eventCollaboration: {
    id: 'collaboration-1',
    eventId: 'event-1',
    eventTitle: 'Encuentro de desarrollo',
    eventSlug: 'encuentro-de-desarrollo',
    status: 'pending',
    hostCommunityName: 'Comunidad anfitriona',
    partnerCommunityId: 'partner',
    startsAt: '2026-09-19T19:00:00Z',
  },
}

describe('EventCollaborationMessage', () => {
  it('lets an authorized recipient accept a pending collaboration invitation', () => {
    const onRespond = vi.fn()
    render(<EventCollaborationMessage message={message} incoming canRespond responding={false} onRespond={onRespond} />)

    expect(screen.getByText('Encuentro de desarrollo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar colaboración' }))
    expect(onRespond).toHaveBeenCalledWith(true)
  })

  it('does not show response controls to the sender or after a response', () => {
    const onRespond = vi.fn()
    const { rerender } = render(<EventCollaborationMessage message={message} incoming={false} canRespond responding={false} onRespond={onRespond} />)
    expect(screen.queryByRole('button', { name: 'Aceptar colaboración' })).not.toBeInTheDocument()
    expect(screen.getByText('Esperando respuesta')).toBeInTheDocument()

    rerender(<EventCollaborationMessage message={{ ...message, eventCollaboration: { ...message.eventCollaboration!, status: 'rejected' } }} incoming canRespond responding={false} onRespond={onRespond} />)
    expect(screen.queryByRole('button', { name: 'Aceptar colaboración' })).not.toBeInTheDocument()
    expect(screen.getByText('Invitación rechazada')).toBeInTheDocument()
  })
})
