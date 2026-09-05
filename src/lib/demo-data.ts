import type { ChatMessage, Community, CommunityConversation, EventItem } from '../types'

export const demoCommunities: Community[] = [
  { id: 'igda-peru', slug: 'igda-peru', name: 'IGDA Perú', description: 'Desarrollo profesional y comunidad.', logoPath: '/brand/logo-igda-peru.png', websiteUrl: 'https://igda.pe', status: 'approved' },
  { id: 'game-jam-peru', slug: 'game-jam-peru', name: 'Game Jam Perú', description: 'Jams y retos creativos.', status: 'approved' },
  { id: 'indie-devs-peru', slug: 'indie-devs-peru', name: 'Indie Devs Perú', description: 'Desarrolladores independientes.', status: 'approved' },
  { id: 'godot-lima', slug: 'godot-lima', name: 'Comunidad Godot Lima', description: 'Usuarios de Godot Engine.', status: 'approved' },
  { id: 'women-games-peru', slug: 'women-games-peru', name: 'Women in Games Perú', description: 'Mujeres en la industria.', status: 'approved' },
]

const demoDate = (date: string, time: string) => `${date}T${time}:00-05:00`

export const demoEvents: EventItem[] = [
  {
    id: 'demo-design-levels', slug: 'diseno-de-niveles', communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png',
    title: 'Diseño de niveles: del papel a la experiencia', description: 'Técnicas prácticas para diseñar niveles memorables e iterar con playtests.', type: 'CHARLA',
    startsAt: demoDate('2026-09-19', '19:00'), endsAt: demoDate('2026-09-19', '21:00'), isAllDay: false, timezone: 'America/Lima', locationType: 'venue', venueName: 'Lima, Perú', address: '', mapUrl: '', meetingUrl: '', meetingProvider: 'other', visibility: 'public', status: 'published',
  },
  {
    id: 'demo-godot', slug: 'introduccion-godot-engine', communityId: 'godot-lima', communityName: 'Comunidad Godot Lima', communitySlug: 'godot-lima',
    title: 'Introducción a Godot Engine', description: 'Una sesión práctica para dar tus primeros pasos y crear un juego 2D.', type: 'TALLER',
    startsAt: demoDate('2026-09-26', '15:00'), endsAt: demoDate('2026-09-26', '18:00'), isAllDay: false, timezone: 'America/Lima', locationType: 'venue', venueName: 'Lima, Perú', address: '', mapUrl: '', meetingUrl: '', meetingProvider: 'other', visibility: 'public', status: 'published',
  },
  {
    id: 'demo-devlog', slug: 'devlog-comparte-tu-proyecto', communityId: 'indie-devs-peru', communityName: 'Indie Devs Perú', communitySlug: 'indie-devs-peru',
    title: 'DevLog: comparte tu proyecto', description: 'Encuentro para mostrar avances, recibir feedback y conectar con desarrolladores.', type: 'MEETUP',
    startsAt: demoDate('2026-10-03', '17:00'), endsAt: demoDate('2026-10-03', '20:00'), isAllDay: false, timezone: 'America/Lima', locationType: 'venue', venueName: 'Lima, Perú', address: '', mapUrl: '', meetingUrl: '', meetingProvider: 'other', visibility: 'public', status: 'published',
  },
  {
    id: 'demo-leadership', slug: 'de-artista-a-lider-de-equipo', communityId: 'women-games-peru', communityName: 'Women in Games Perú', communitySlug: 'women-games-peru',
    title: 'De artista a líder de equipo', description: 'Conversación sobre liderazgo, comunicación y procesos creativos en equipos de juego.', type: 'CHARLA',
    startsAt: demoDate('2026-10-10', '19:00'), endsAt: demoDate('2026-10-10', '21:00'), isAllDay: false, timezone: 'America/Lima', locationType: 'venue', venueName: 'Lima, Perú', address: '', mapUrl: '', meetingUrl: '', meetingProvider: 'other', visibility: 'public', status: 'published',
  },
]

export const demoConversations: CommunityConversation[] = [
  {
    id: 'demo-conversation-women-games',
    status: 'active',
    myCommunity: { communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png' },
    otherCommunity: { communityId: 'women-games-peru', communityName: 'Women in Games Perú', communitySlug: 'women-games-peru' },
    requestedByCommunityId: 'igda-peru',
    lastMessageAt: '2026-09-03T16:30:00-05:00',
    lastMessageBody: '¡Gracias! Coordinemos los detalles de la próxima actividad.',
    lastMessageAuthorDisplayName: 'Micaela R.',
    unreadCount: 1,
    archivedAt: null,
    createdAt: '2026-08-25T10:00:00-05:00',
  },
  {
    id: 'demo-conversation-game-jam',
    status: 'pending',
    myCommunity: { communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png' },
    otherCommunity: { communityId: 'game-jam-peru', communityName: 'Game Jam Perú', communitySlug: 'game-jam-peru' },
    requestedByCommunityId: 'game-jam-peru',
    lastMessageAt: null,
    lastMessageBody: null,
    lastMessageAuthorDisplayName: null,
    unreadCount: 0,
    archivedAt: null,
    createdAt: '2026-09-02T09:20:00-05:00',
  },
]

export const demoMessages: Record<string, ChatMessage[]> = {
  'demo-conversation-women-games': [
    {
      id: 'demo-message-1',
      conversationId: 'demo-conversation-women-games',
      authorUserId: 'demo-user-women-games',
      authorCommunity: { communityId: 'women-games-peru', communityName: 'Women in Games Perú', communitySlug: 'women-games-peru' },
      authorDisplayName: 'Micaela R.',
      body: 'Hola, nos gustaría coordinar una actividad conjunta para octubre.',
      createdAt: '2026-09-03T15:58:00-05:00',
    },
    {
      id: 'demo-message-2',
      conversationId: 'demo-conversation-women-games',
      authorUserId: 'demo-user-igda',
      authorCommunity: { communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png' },
      authorDisplayName: 'Heinz',
      body: '¡Gracias! Coordinemos los detalles de la próxima actividad.',
      createdAt: '2026-09-03T16:30:00-05:00',
    },
  ],
}
