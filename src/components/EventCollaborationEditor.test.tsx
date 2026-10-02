import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventCollaborationEditor } from './EventCollaborationEditor'
import type { Community } from '../types'

const communities: Community[] = [
  { id: 'host', slug: 'host', name: 'Anfitriona', description: '', status: 'approved' },
  { id: 'partner', slug: 'partner', name: 'Comunidad aliada', description: '', status: 'approved' },
  { id: 'pending', slug: 'pending', name: 'No aprobada', description: '', status: 'pending' },
]

describe('EventCollaborationEditor', () => {
  it('offers approved communities except the host and explains acceptance', () => {
    const onCommunityIdsChange = vi.fn()
    render(<EventCollaborationEditor
      hostCommunityId="host"
      communities={communities}
      communityIds={[]}
      externalCollaborators={[]}
      onCommunityIdsChange={onCommunityIdsChange}
      onExternalCollaboratorsChange={vi.fn()}
    />)

    expect(screen.getByText('Comunidad aliada')).toBeInTheDocument()
    expect(screen.queryByText('Anfitriona')).not.toBeInTheDocument()
    expect(screen.queryByText('No aprobada')).not.toBeInTheDocument()
    expect(screen.getByText('La persona administradora de cada comunidad recibirá una invitación en su conversación.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCommunityIdsChange).toHaveBeenCalledWith(['partner'])
  })

  it('adds external partners and lets the organizer enter their public contact link', () => {
    const onExternalCollaboratorsChange = vi.fn()
    render(<EventCollaborationEditor
      hostCommunityId={null}
      communities={communities}
      communityIds={[]}
      externalCollaborators={[]}
      onCommunityIdsChange={vi.fn()}
      onExternalCollaboratorsChange={onExternalCollaboratorsChange}
    />)

    expect(screen.getByText('Los eventos independientes no pueden invitar comunidades registradas. Puedes agregar colaboradores externos.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar externa' }))
    const [added] = onExternalCollaboratorsChange.mock.calls[0][0]
    expect(added).toEqual({ id: expect.any(String), name: '', contactUrl: '' })
  })
})
