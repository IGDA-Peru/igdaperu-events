import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from './auth/auth-context'
import App from './App'
import { SiteHeader } from './components/SiteHeader'
import { EventPreviewDrawer } from './components/EventPreviewDrawer'
import { EventResults } from './components/EventViews'
import { CommunitySetupPrompt } from './components/CommunitySetupPrompt'
import { CommunityEventsPage, CommunitySettingsPage, DashboardPage, EventEditorPage, ManagedEventsPage, PlatformAdminPage } from './pages/AppPages'
import { ConversationsPage } from './pages/ChatPage'
import { CommunityDetailPage, EventProposalPage, PublicAgendaPage } from './pages/PublicPages'
import { demoEvents } from './lib/demo-data'
import * as data from './lib/data'

vi.mock('./lib/supabase', () => ({
  appUrl: 'http://localhost:5173',
  isSupabaseConfigured: false,
  supabase: null,
}))

describe('public events', () => {
  it('lets proposal authors specify a custom event type', () => {
    render(<MemoryRouter initialEntries={['/proponer-evento']}><EventProposalPage /></MemoryRouter>)

    const typeSelect = screen.getByRole('combobox', { name: 'Tipo de evento' })
    fireEvent.change(typeSelect, { target: { value: 'OTRO' } })
    expect(screen.getByRole('textbox', { name: 'Especifica el tipo de evento' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Especifica el tipo de evento' }), { target: { value: 'Festival' } })
    expect(screen.getByRole('textbox', { name: 'Especifica el tipo de evento' })).toHaveValue('Festival')
  })

  it('shows public events using the local demo fallback', async () => {
    render(<App />)
    expect(screen.queryByRole('heading', { name: 'Próximos eventos' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Agenda IGDA Perú' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Publicar evento/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ver Diseño de niveles/ }).length).toBeGreaterThan(0))
    expect(screen.getByRole('combobox', { name: 'Tiempo' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lugar' })).toBeInTheDocument()
    const communitySelect = screen.getByRole('combobox', { name: 'Comunidad' })
    expect(communitySelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: demoEvents[0].communityName })).toBeInTheDocument()
    expect(document.querySelectorAll('.event-results .filter-control')).toHaveLength(3)
    expect(screen.getByRole('combobox', { name: 'Lugar' })).toHaveValue('all')
    expect(screen.queryByRole('option', { name: 'Todos los departamentos del Perú' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Internacional' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lima' })).not.toBeInTheDocument()
    expect(screen.getByText(/Vista de demostración/)).toBeInTheDocument()
    fireEvent.change(communitySelect, { target: { value: demoEvents[0].communityId } })
    expect(screen.getByRole('button', { name: demoEvents[0].title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: demoEvents[1].title })).not.toBeInTheDocument()
    const eventsToolbar = document.querySelector('.event-results-toolbar')
    expect(eventsToolbar?.querySelector('.event-focus-button')).toBeInTheDocument()
    expect(eventsToolbar?.querySelector('[aria-label="Vista de eventos"]')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Comunidades/ }).length).toBeGreaterThan(0)
    expect(document.querySelector('.community-arrow')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Ver Diseño de niveles/ })[0])
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inscribirme' })).toHaveAttribute('href', 'https://igda.pe/registro')
    expect(screen.getByText('Fecha')).toBeInTheDocument()
    expect(screen.queryByText('Reportar este evento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
    expect(screen.queryByRole('dialog', { name: /Diseño de niveles/ })).not.toBeInTheDocument()

    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Calendario' }))
      expect(screen.getByRole('region', { name: /Calendario/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tiempo' })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Lugar' })).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Buscar eventos' })).toBeInTheDocument()
      const calendarToolbar = document.querySelector('.event-results-toolbar')
      expect(calendarToolbar?.querySelector('.event-results-toolbar-start .event-focus-button')).toBeInTheDocument()
      expect(calendarToolbar?.querySelector('.event-results-toolbar-center [aria-label="Vista de eventos"]')).toBeInTheDocument()
      expect(calendarToolbar?.querySelector('.event-results-toolbar-end .search-field')).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Comunidad' })).toHaveValue(demoEvents[0].communityId)
      expect(scrollIntoView).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Línea de tiempo' }))
      expect(screen.getByRole('region', { name: /Línea de tiempo/ })).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tiempo' })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Lugar' })).not.toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Filtrar timeline por comunidad' })).toHaveValue(demoEvents[0].communityId)
      expect(document.querySelector('.timeline-legend')).not.toBeInTheDocument()
      expect(scrollIntoView).not.toHaveBeenCalled()
      fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar timeline por comunidad' }), { target: { value: demoEvents[1].communityId } })
      expect(screen.getByRole('combobox', { name: 'Filtrar timeline por comunidad' })).toHaveValue(demoEvents[1].communityId)
      expect(screen.getByRole('button', { name: /Introducción a Godot Engine/ })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
      expect(screen.getByRole('combobox', { name: 'Comunidad' })).toHaveValue(demoEvents[1].communityId)
      fireEvent.change(screen.getByRole('combobox', { name: 'Comunidad' }), { target: { value: 'all' } })
    } finally {
      if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView })
      else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
    }
    fireEvent.click(screen.getAllByRole('button', { name: /Diseño de niveles/ })[0])
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))

    fireEvent.click(screen.getByRole('button', { name: 'Línea de tiempo' }))
    expect(screen.getByRole('region', { name: /Línea de tiempo/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Diseño de niveles/ }))
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
  })

  it('renders the Spotlight embed preview on the home page when requested', () => {
    window.history.pushState({}, '', '/?spotlight=1')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Spotlight de eventos' })).toBeInTheDocument()
    expect(screen.getByTitle('Vista previa del embed Spotlight')).toHaveAttribute('src', '/embed/spotlight?embedded=1')
    expect(screen.getByRole('link', { name: 'Volver a la agenda' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('heading', { name: 'Próximos eventos' })).not.toBeInTheDocument()
  })

  it('lets authenticated users switch between the editor and public agenda modes', async () => {
    const listEventsSpy = vi.spyOn(data, 'listEvents').mockImplementation(async (options = {}) => options.network ? [{ ...demoEvents[0], id: 'network-event', title: 'Evento solo de comunidades', visibility: 'network' }] : [demoEvents[0]])
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-agenda', email: 'editor@comunidad.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-agenda', displayName: 'Editor' },
      memberships: [],
      roles: ['community_editor'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter><PublicAgendaPage /></MemoryRouter></AuthContext.Provider>)

    expect(screen.getByRole('group', { name: 'Modo de visualización' })).toBeInTheDocument()
    expect(screen.getAllByText('Visualización').length).toBeGreaterThan(0)
    expect(screen.queryByText('Público y privado')).not.toBeInTheDocument()
    expect(screen.queryByText('Cuenta activa')).not.toBeInTheDocument()
    expect(screen.queryByText('Modo de agenda')).not.toBeInTheDocument()
    expect(screen.queryByText('Cambia entre la vista de edición con eventos de la red y cómo la ve el público.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modo editor' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('Evento solo de comunidades')).toBeInTheDocument()
    expect(screen.getByText('Solo Comunidades')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Modo público' }))
    await waitFor(() => expect(listEventsSpy).toHaveBeenLastCalledWith({ network: false }))
    expect(screen.getByRole('button', { name: 'Modo público' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Evento solo de comunidades')).not.toBeInTheDocument()
    expect(screen.getByText('Diseño de niveles: del papel a la experiencia')).toBeInTheDocument()
    listEventsSpy.mockRestore()
  })

  it('embeds the Notion communities directory without the old intro', () => {
    window.history.pushState({}, '', '/comunidades')
    render(<App />)
    expect(screen.getByTitle('Directorio de comunidades IGDA Perú')).toHaveAttribute('src', 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21')
    expect(screen.queryByRole('heading', { name: 'Comunidades' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrirlo en Notion/ })).toHaveAttribute('href', 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21')
  })

  it('renders the compact home embed with three events and the main calendar link', async () => {
    window.history.pushState({}, '', '/embed/inicio')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver todos los eventos/ })).toHaveAttribute('href', 'https://igda.pe/comunidad/calendario/')
    expect(screen.getAllByRole('article')).toHaveLength(3)

    fireEvent.click(screen.getAllByRole('button', { name: /Ver Diseño de niveles/ })[0])
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toHaveClass('event-preview-drawer--modal')
    expect(document.querySelector('.event-preview-layer--modal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'IGDA Perú' })).toHaveAttribute('href', 'https://igda.pe/comunidad/')
    expect(screen.getByRole('link', { name: 'IGDA Perú' })).toHaveAttribute('target', '_top')
  })

  it('renders the spotlight embed with one featured event and three following events', async () => {
    const spotlightEvents = demoEvents.map((event, index) => index === 0 ? { ...event, registrationUrl: '' } : event)
    const listEventsSpy = vi.spyOn(data, 'listEvents').mockResolvedValue(spotlightEvents)
    window.history.pushState({}, '', '/embed/spotlight?embedded=1')
    render(<App />)

    expect(await screen.findByRole('heading', { name: demoEvents[0].title })).toBeInTheDocument()
    expect(listEventsSpy).toHaveBeenCalledWith({ upcomingOnly: true, limit: 4 })
    expect(screen.getByText('Agenda')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(screen.getByText('Actividades de todas las comunidades de IGDA Perú.')).toBeInTheDocument()
    expect(screen.getByText('Próximo evento')).toBeInTheDocument()
    expect(screen.getByText(`Organiza ${demoEvents[0].communityName}`)).toBeInTheDocument()
    expect(document.querySelector('.spotlight-embed-header')).not.toBeInTheDocument()
    expect(screen.queryByText('Comunidad. Juegos. Oportunidades.')).not.toBeInTheDocument()
    expect(document.querySelector('.spotlight-feature-card')).toHaveClass('spotlight-feature-card--no-media')
    expect(document.querySelector('.spotlight-feature-media')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver evento' })).toHaveClass('spotlight-feature-action--icon')
    expect(screen.getByRole('heading', { name: 'Siguientes eventos' })).toBeInTheDocument()
    expect(document.querySelectorAll('.spotlight-upcoming-item')).toHaveLength(3)
    expect(document.querySelector('.spotlight-upcoming')?.querySelector('.spotlight-all-events')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver todos los eventos/ }).getAttribute('href')).toBe(new URL('/', window.location.origin).toString())
    expect(screen.queryByRole('link', { name: 'Inscribirme' })).not.toBeInTheDocument()

    fireEvent.click(document.querySelector('.spotlight-feature-card') as HTMLElement)
    expect(screen.getByRole('dialog', { name: demoEvents[0].title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))

    fireEvent.click(screen.getByRole('button', { name: `Ver ${demoEvents[1].title}` }))
    expect(screen.getByRole('dialog', { name: demoEvents[1].title })).toBeInTheDocument()
    listEventsSpy.mockRestore()
  })

  it('uses the calendar view by default in the large event embed and allows switching views', async () => {
    window.history.pushState({}, '', '/embed')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendario' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: /Calendario/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tarjetas' }))
    expect(screen.getByRole('button', { name: 'Tarjetas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Línea de tiempo' }))
    expect(screen.getByRole('button', { name: 'Línea de tiempo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('region', { name: /Línea de tiempo/ })).toBeInTheDocument()
  })

  it('redirects legacy event URLs back to the agenda', async () => {
    window.history.pushState({}, '', '/eventos/diseno-de-niveles')
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('shows the community logo and main website in the community header', async () => {
    render(<AuthContext.Provider value={{ configured: false, loading: false, session: null, user: null, profile: null, memberships: [], roles: [], signOut: vi.fn().mockResolvedValue(undefined), refreshUserData: vi.fn().mockResolvedValue(undefined) }}><MemoryRouter initialEntries={['/comunidades/igda-peru']}><Routes><Route path="/comunidades/:slug" element={<CommunityDetailPage />} /></Routes></MemoryRouter></AuthContext.Provider>)

    expect(await screen.findByRole('heading', { name: 'IGDA Perú' })).toBeInTheDocument()
    expect(document.querySelector('.community-hero img')).toHaveAttribute('src', '/brand/logo-igda-peru.png')
    expect(screen.getByRole('link', { name: /Visitar sitio principal/ })).toHaveAttribute('href', 'https://igda.pe')
  })

  it('organizes the manager dashboard around communities and events', async () => {
    const listManagedEventsSpy = vi.spyOn(data, 'listManagedEvents').mockResolvedValue([demoEvents[0]])
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Comunidad' },
      memberships: [{ communityId: 'community-1', communityName: 'IGDA Perú', communitySlug: 'igda-peru', communityLogoPath: '/brand/logo-igda-peru.png', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app']}><SiteHeader /><DashboardPage /></MemoryRouter></AuthContext.Provider>)
    const grid = document.querySelector('.dashboard-grid')
    expect(grid?.children[0]).toHaveClass('dashboard-sidebar')
    expect(grid?.children[1]).toHaveClass('dashboard-main')
    const sidebarDisclosure = document.querySelector('.dashboard-sidebar-disclosure')
    expect(sidebarDisclosure).toBeInTheDocument()
    expect(sidebarDisclosure?.querySelector('summary')).toHaveAttribute('aria-label', 'Mostrar u ocultar comunidades y conversaciones')
    expect(sidebarDisclosure?.querySelector('.dashboard-sidebar-content')?.children).toHaveLength(2)
    expect(sidebarDisclosure?.querySelector('.dashboard-sidebar-content')?.children[0]).toHaveClass('dashboard-community-panel')
    expect(sidebarDisclosure?.querySelector('.dashboard-sidebar-content')?.children[1]).toHaveClass('dashboard-chat-summary')
    const originalInnerWidth = window.innerWidth
    const detailsElement = sidebarDisclosure as HTMLDetailsElement
    detailsElement.open = false
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 })
    window.dispatchEvent(new Event('resize'))
    expect(detailsElement.open).toBe(true)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
    expect(screen.getByRole('heading', { name: 'Hola, Comunidad' })).toBeInTheDocument()
    expect(screen.getByText('Tu comunidad')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tus eventos' })).toBeInTheDocument()
    expect(document.querySelector('.dashboard-community-panel')).toBeInTheDocument()
    expect(document.querySelector('.dashboard-sidebar .dashboard-chat-summary')).toBeInTheDocument()
    expect(document.querySelector('.dashboard-community-panel')?.nextElementSibling).toHaveClass('dashboard-chat-summary')
    expect(document.querySelector('.dashboard-grid--with-chat')?.children).toHaveLength(2)
    expect(document.querySelector('.brand-wordmark')).toHaveAttribute('src', '/brand/igda-peru-wordmark.svg')
    expect(document.querySelector('.brand-copy small')).toHaveTextContent('Eventos')
    expect(document.querySelector('.account-button img')).toHaveAttribute('src', '/brand/logo-igda-peru.png')
    expect(screen.getByRole('link', { name: /Nuevo evento/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ver todos los eventos' })).toHaveAttribute('href', '/app/eventos'))
    listManagedEventsSpy.mockRestore()
    expect(screen.queryByText('Este es tu espacio para consultar y administrar tus eventos.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Panel/ })).toHaveAttribute('href', '/app')
    expect(screen.queryByRole('link', { name: /Publicar evento/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invitar editor' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gestionar comunidad' })).toHaveAttribute('href', '/app/comunidad')
    expect(screen.queryByRole('link', { name: 'Gestionar comunidades' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Invitar editor' }))
    expect(screen.getByRole('dialog', { name: 'Invitar editor' })).toBeInTheDocument()
    expect(screen.getByText('Editor de comunidad')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Invitar editor' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de perfil' }))
    expect(screen.getByRole('menu', { name: 'Opciones de perfil' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Editar perfil/ })).toHaveAttribute('href', '/app/editar-perfil')
    expect(screen.getByRole('menuitem', { name: /Cambiar contraseña/ })).toHaveAttribute('href', '/app/cambiar-contrasena')
    fireEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }))
    expect(authValue.signOut).toHaveBeenCalled()
  })

  it('allows community admins to delete events that already passed', async () => {
    const pastEvent = { ...demoEvents[0], startsAt: '2026-08-19T19:00:00-05:00', endsAt: '2026-08-19T21:00:00-05:00' }
    const listManagedEventsSpy = vi.spyOn(data, 'listManagedEvents').mockResolvedValue([pastEvent])
    const deleteEventSpy = vi.spyOn(data, 'deleteEvent').mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Comunidad' },
      memberships: [{ communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app']}><DashboardPage /></MemoryRouter></AuthContext.Provider>)

    const deleteButton = await screen.findByRole('button', { name: `Eliminar ${pastEvent.title}` })
    fireEvent.click(deleteButton)
    await waitFor(() => expect(deleteEventSpy).toHaveBeenCalledWith(pastEvent.id))

    expect(confirmSpy).toHaveBeenCalledWith(`¿Eliminar “${pastEvent.title}”? Esta acción no se puede deshacer.`)
    expect(screen.getByText('Evento eliminado.')).toBeInTheDocument()
    listManagedEventsSpy.mockRestore()
    deleteEventSpy.mockRestore()
    confirmSpy.mockRestore()
  })

  it('makes community information read-only and separates registered emails from invitations', async () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Comunidad' },
      memberships: [{ communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app/comunidad']}><CommunitySettingsPage /></MemoryRouter></AuthContext.Provider>)
    const backToDashboardLink = await screen.findByRole('link', { name: 'Volver al panel' })
    expect(backToDashboardLink).toHaveAttribute('href', '/app')
    expect(backToDashboardLink).toHaveClass('secondary-button')
    expect(backToDashboardLink.closest('.community-content-section')).toBeNull()
    const membersPanel = await screen.findByRole('tabpanel', { name: 'Miembros' })
    expect(within(membersPanel).getByRole('heading', { name: 'Invitar editor' })).toBeInTheDocument()
    expect(membersPanel.firstElementChild).toBe(membersPanel.querySelector('.community-inline-invite-section'))
    expect(document.querySelector('.community-content-section > .community-inline-invite-section')).not.toBeInTheDocument()
    expect(within(membersPanel).getByRole('heading', { name: 'Miembros' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Comunidad' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Miembros' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Información pública' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: 'Invitar editor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar invitación' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Información pública' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Información pública' }))
    expect(screen.getByRole('heading', { name: 'Información pública' })).toBeInTheDocument()
    expect(screen.getByText(/heredados desde Google Sheets/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Logo de la comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo de IGDA Perú' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Color de la comunidad' })).toBeInTheDocument()
    const publicPanel = document.querySelector('#community-public-panel')
    const publicPanelOrder = Array.from(publicPanel?.children ?? []).map((element) => element.className)
    expect(publicPanelOrder.indexOf('community-logo-editor')).toBeLessThan(publicPanelOrder.indexOf('community-color-editor'))
    expect(publicPanelOrder.indexOf('community-color-editor')).toBeLessThan(publicPanelOrder.indexOf('public-info-grid'))
    expect(screen.getByLabelText('Color de la comunidad')).toHaveValue('#d82028')
    expect(screen.getByRole('button', { name: 'Guardar color' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Actualizar logo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Invitar persona' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Descripción' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Integración' }))
    expect(screen.getByRole('heading', { name: 'Integración' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Integración' })).toHaveAttribute('aria-selected', 'true')
    expect((screen.getByRole('textbox', { name: 'Código del embed: Vista de calendario' }) as HTMLTextAreaElement).value).toContain('/embed?community=igda-peru')
    expect((screen.getByRole('textbox', { name: 'Código del embed: Vista simple de tarjetas' }) as HTMLTextAreaElement).value).toContain('/embed/inicio?community=igda-peru&embedded=1')
    const spotlightEmbedCode = (screen.getByRole('textbox', { name: 'Código del embed: Spotlight + 3 siguientes eventos' }) as HTMLTextAreaElement).value
    expect(spotlightEmbedCode).toContain('/embed/spotlight?embedded=1')
    expect(spotlightEmbedCode).not.toContain('community=')
    expect(screen.getByText(/Comparte el código elegido con el administrador de IGDA Perú/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al panel' })).toBe(backToDashboardLink)
    expect(screen.queryByTitle(/Eventos de IGDA Perú/)).not.toBeInTheDocument()
  })

  it('gives platform administrators the selectable invite flow and plural management link', async () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'admin-1', email: 'admin@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Admin' },
      memberships: [],
      roles: ['platform_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app']}><DashboardPage /></MemoryRouter></AuthContext.Provider>)
    expect(screen.getByRole('button', { name: 'Invitar persona' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gestionar comunidades' })).toHaveAttribute('href', '/app/comunidad')
    fireEvent.click(screen.getByRole('button', { name: 'Invitar persona' }))
    expect(screen.getByRole('dialog', { name: 'Invitar persona' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'IGDA Perú' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Rol' })).toHaveValue('community_admin')
    fireEvent.change(screen.getByRole('combobox', { name: 'Rol' }), { target: { value: 'community_editor' } })
    expect(screen.getByText('Administrador de comunidad')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Editor de comunidad', selected: true })).toBeInTheDocument()
  })

  it('organizes the IGDA administration panel around its operational areas', async () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'admin-1', email: 'admin@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Admin' },
      memberships: [],
      roles: ['platform_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app/admin']}><PlatformAdminPage /></MemoryRouter></AuthContext.Provider>)

    expect(await screen.findByRole('heading', { name: 'Administración IGDA' })).toBeInTheDocument()
    expect(screen.getByText('Comunidades activas')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reportes pendientes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nueva comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mantenimiento y sincronización' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comunidades' })).toBeInTheDocument()
    expect(document.querySelector('.admin-management-grid')).toBeInTheDocument()
  })

  it('lets authenticated users browse the community event network from the panel', async () => {
    render(<MemoryRouter initialEntries={['/app/eventos/comunidad']}><CommunityEventsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Eventos de la comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Eventos de la comunidad' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('region', { name: /Línea de tiempo/ })).toBeInTheDocument()
    expect(screen.getAllByText('Comunidad Godot Lima').length).toBeGreaterThan(0)
  })

  it('shows the private community inbox with identities and message composer', async () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Comunidad' },
      memberships: [{ communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app/conversaciones']}><ConversationsPage /></MemoryRouter></AuthContext.Provider>)

    expect(await screen.findByRole('button', { name: /Women in Games Perú/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Women in Games Perú/ }))
    expect(await screen.findByText('Hola, nos gustaría coordinar una actividad conjunta para octubre.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Mensaje' })).toBeInTheDocument()
    expect(screen.getByText(/Solo los miembros autorizados/)).toBeInTheDocument()
    expect(screen.queryByText('comunidad@igda.pe')).not.toBeInTheDocument()
  })

  it('renders the event editor with clear field requirements', async () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Comunidad' },
      memberships: [{ communityId: 'community-1', communityName: 'IGDA Perú', communitySlug: 'igda-peru', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app/eventos/nuevo']}><EventEditorPage /></MemoryRouter></AuthContext.Provider>)

    expect(await screen.findByRole('tab', { name: /Información principal/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Comunidad: IGDA Perú')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Comunidad' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Título del evento/ })).toBeInTheDocument()
    expect(screen.getByText('Banner del evento')).toBeInTheDocument()
    expect(screen.getByText(/se optimiza automáticamente.*1600 × 900/)).toBeInTheDocument()
    expect(document.querySelector('.event-banner-dropzone')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de actividad' }), { target: { value: 'OTRO' } })
    expect(screen.getByRole('textbox', { name: /Especifica el tipo de evento/ })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /Especifica el tipo de evento/ }), { target: { value: 'Feria' } })
    expect(screen.getByRole('textbox', { name: /Especifica el tipo de evento/ })).toHaveValue('Feria')
    const summaryToggle = screen.getByRole('button', { name: 'Resumen' })
    expect(summaryToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(summaryToggle)
    expect(summaryToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('complementary', { name: 'Resumen del evento' })).toBeInTheDocument()
    expect(screen.getByText('Borrador / Solo Comunidades')).toBeInTheDocument()
    expect(screen.getByText('Falta:')).toBeInTheDocument()
    expect(screen.queryByText('El banner es opcional para cualquiera de las tres opciones.')).not.toBeInTheDocument()
    expect(document.querySelector('.editor-required-note')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar resumen' }))
    expect(summaryToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('heading', { name: 'Información principal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Volver a tus eventos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Crear evento' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Enlace para unirse/)).not.toBeInTheDocument()
    expect(screen.queryByText('Obligatorio')).not.toBeInTheDocument()
    expect(screen.getAllByText('*').length).toBeGreaterThan(0)
    expect(screen.queryByText('Opcional')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Revisar y publicar/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Los eventos de comunidades aprobadas pueden publicarse directamente.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByRole('tab', { name: /Fecha y hora/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { name: 'Fecha y hora' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha del evento/)).toBeInTheDocument()
    expect(screen.getByText('Duración del evento').parentElement?.querySelector('.field-required')).toBeNull()
    fireEvent.change(screen.getByLabelText(/Fecha del evento/), { target: { value: '2026-09-18' } })
    expect(await screen.findByText(/No encontramos eventos cruzados/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Varias fechas/ }))
    expect(screen.getByLabelText(/Fecha de inicio/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha de fin/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Fecha de fin/), { target: { value: '2026-09-20' } })
    expect(await screen.findByText(/Hay un evento en el mismo horario/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Todo el día/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Hora de inicio/)).toHaveValue('09:00')
    expect(screen.getByRole('button', { name: /Sección anterior/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Información principal/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /Título del evento/ }), { target: { value: 'Evento de prueba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }))
    expect(screen.getByText('Para publicar')).toBeInTheDocument()
    expect(screen.getByText('Falta:')).toBeInTheDocument()
    expect(screen.getAllByText('Descripción').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ubicación').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar resumen' }))
    fireEvent.click(screen.getByRole('tab', { name: /Fecha y hora/ }))
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByRole('tab', { name: /Inscripción/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: /Ubicación y Acceso/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inscripción' })).toBeInTheDocument()
    expect(screen.getByText(/gestiona las inscripciones desde tu comunidad.*activa las opciones de ubicación y conexión/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Enlace de inscripción/)).toBeInTheDocument()
    expect(screen.getByText('¿Qué quieres gestionar en este evento?').parentElement?.querySelector('.field-required')).toBeNull()
    expect(screen.getByRole('radio', { name: /Solo inscripción/ })).toBeChecked()
    expect(screen.getByRole('tab', { name: /Inscripción/ }).querySelector('span')).toHaveTextContent('03')
    expect(screen.getByRole('tab', { name: /Publicación/ }).querySelector('svg')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Ubicación y acceso/ }))
    expect(screen.getByRole('tab', { name: /Ubicación y Acceso/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Ubicación y Acceso/ }).querySelector('span')).toHaveTextContent('04')
    fireEvent.click(screen.getByRole('tab', { name: /Ubicación y Acceso/ }))
    expect(screen.getByRole('tab', { name: /Ubicación y Acceso/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { name: /Ubicación y acceso/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Nombre del lugar')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar lugar o dirección')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /No encuentro el lugar/ })).not.toBeInTheDocument()
    expect(document.querySelector('.summary-location-access')).toBeInTheDocument()
    expect(screen.getByText('Acceso')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Enlace de Google Maps/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Abrir Google Maps/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Selecciona el punto exacto')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Regional/ }))
    expect(screen.getByRole('radio', { name: /Regional/ })).toBeChecked()
    const departmentSelect = screen.getByRole('combobox', { name: 'Departamento' })
    fireEvent.change(departmentSelect, { target: { value: 'Lima' } })
    expect(departmentSelect).toHaveValue('Lima')
    const provinceSelect = screen.getByRole('combobox', { name: /Provincia/ })
    fireEvent.change(provinceSelect, { target: { value: 'Lima' } })
    expect(provinceSelect).toHaveValue('Lima')
    expect(screen.queryByLabelText(/Enlace para unirse/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Ubicación exacta/ }))
    expect(screen.getByLabelText('Buscar lugar o dirección')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /No encuentro el lugar/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Online/ }))
    expect(screen.queryByText('Nombre del lugar')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Enlace para unirse/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Híbrido/ }))
    expect(screen.queryByText('Nombre del lugar')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Enlace para unirse/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Información principal' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.queryByRole('heading', { name: 'Publicación' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Revisar y publicar/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Siguiente/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Revisar y publicar/ }))
    const publicationDialog = screen.getByRole('dialog', { name: 'Publicar evento' })
    expect(within(publicationDialog).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['network', 'public'])
  })

  it('offers draft or discard options when cancelling a new event with changes', async () => {
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-1', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-1', displayName: 'Comunidad' },
      memberships: [{ communityId: 'community-1', communityName: 'IGDA Perú', communitySlug: 'igda-peru', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app/eventos/nuevo']}><EventEditorPage /></MemoryRouter></AuthContext.Provider>)

    const title = await screen.findByRole('textbox', { name: /Título del evento/ })
    fireEvent.change(title, { target: { value: 'Evento de prueba' } })
    fireEvent.click(screen.getByRole('link', { name: 'Cancelar' }))

    expect(screen.getByRole('dialog', { name: '¿Salir del editor?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir sin guardar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar borrador y salir' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(screen.queryByRole('dialog', { name: '¿Salir del editor?' })).not.toBeInTheDocument()
  })
})

describe('event preview layout', () => {
  it('keeps the Google Maps action in a compact metadata control', () => {
    const event = { ...demoEvents[0], mapUrl: 'https://maps.google.com/?q=Miraflores' }
    render(<MemoryRouter><EventPreviewDrawer event={event} onClose={vi.fn()} presentation="modal" /></MemoryRouter>)

    const mapLink = screen.getByRole('link', { name: /Ver en Google Maps/ })
    expect(mapLink).toHaveClass('event-preview-map-link')
    expect(mapLink).toHaveAttribute('href', event.mapUrl)
    expect(mapLink.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Fecha').closest('.event-preview-meta-item')).toBeInTheDocument()
  })

  it('keeps the location and shows a compact registration link', () => {
    const registrationUrl = 'https://forms.example.com/registro-greet-meet'
    const event = { ...demoEvents[2], registrationUrl, accessMode: 'registration_only' as const }
    render(<MemoryRouter><EventPreviewDrawer event={event} onClose={vi.fn()} presentation="modal" /></MemoryRouter>)

    expect(screen.getByText('Ubicación')).toBeInTheDocument()
    const registrationLink = screen.getByRole('link', { name: /Abrir enlace de inscripción/ })
    expect(registrationLink).toHaveAttribute('href', registrationUrl)
    expect(registrationLink).toHaveClass('event-preview-map-link', 'event-preview-registration-link')
  })

  it('keeps the preview columns in the intended content order', () => {
    const event = { ...demoEvents[0], coverPath: '/events/demo-banner.webp' }
    render(<MemoryRouter><EventPreviewDrawer event={event} onClose={vi.fn()} presentation="modal" /></MemoryRouter>)

    const drawer = document.querySelector('.event-preview-drawer--modal')
    expect(drawer).toBeInTheDocument()
    const leftColumn = drawer?.querySelector('.event-preview-left-column')
    const rightColumn = drawer?.querySelector('.event-preview-right-column')
    const leftChildren = Array.from(leftColumn?.children || [])
    const indexOfLeft = (selector: string) => leftChildren.findIndex((child) => child.matches(selector))
    expect(indexOfLeft('h2')).toBeLessThan(indexOfLeft('.event-preview-cover-frame'))
    expect(indexOfLeft('.event-preview-cover-frame')).toBeLessThan(indexOfLeft('.event-preview-description'))
    expect(leftColumn).toBeInTheDocument()
    expect(rightColumn).toBeInTheDocument()
    const meta = rightColumn?.querySelector('.event-preview-meta')
    const actions = rightColumn?.querySelector('.event-preview-actions')
    expect(meta).toBeInTheDocument()
    expect(actions).toBeInTheDocument()
    if (meta && actions) {
      expect(meta.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('centers the left content when the preview has no banner', () => {
    const event = { ...demoEvents[0], coverPath: null }
    render(<MemoryRouter><EventPreviewDrawer event={event} onClose={vi.fn()} presentation="modal" /></MemoryRouter>)

    const leftColumn = document.querySelector('.event-preview-left-column')
    expect(leftColumn).toHaveClass('event-preview-left-column--no-cover')
    expect(leftColumn?.querySelector('.event-preview-cover-frame')).not.toBeInTheDocument()
  })
})

describe('public event results', () => {
  it('groups card results with subtle month dividers', () => {
    render(<MemoryRouter><EventResults events={[demoEvents[0], demoEvents[1], demoEvents[2]]} viewMode="cards" showVisibility={false} onEventOpen={vi.fn()} showViewLabel={false} showFocusButton={false} /></MemoryRouter>)

    expect([...document.querySelectorAll('.event-month-divider')].map((divider) => divider.textContent?.trim())).toEqual(['Setiembre de 2026', 'Octubre de 2026'])
    expect(screen.getByRole('separator', { name: 'Mes Setiembre de 2026' })).toBeInTheDocument()
  })

  it('loads card results in controlled batches without the view label', () => {
    const events = Array.from({ length: 7 }, (_, index) => ({ ...demoEvents[index % demoEvents.length], id: `demo-card-${index}` }))
    render(<MemoryRouter><EventResults events={events} viewMode="cards" showVisibility={false} onEventOpen={vi.fn()} showViewLabel={false} showFocusButton={false} /></MemoryRouter>)

    expect(screen.queryByText('Vista: Tarjetas')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.event-list > .event-row')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más eventos' }))
    expect(document.querySelectorAll('.event-list > .event-row')).toHaveLength(7)
    expect(screen.queryByRole('button', { name: 'Cargar más eventos' })).not.toBeInTheDocument()
  })
})

describe('managed event sections', () => {
  it('separates active past events from archived events in the panel', async () => {
    const listManagedEventsSpy = vi.spyOn(data, 'listManagedEvents').mockResolvedValue([
      { ...demoEvents[0], id: 'managed-upcoming', title: 'Evento próximo del panel', status: 'published' },
      { ...demoEvents[0], id: 'managed-past', title: 'Evento pasado activo', startsAt: '2026-08-19T19:00:00-05:00', endsAt: '2026-08-19T21:00:00-05:00', status: 'published' },
      { ...demoEvents[0], id: 'managed-archived', title: 'Evento archivado', startsAt: '2026-08-20T19:00:00-05:00', endsAt: '2026-08-20T21:00:00-05:00', status: 'archived' },
    ])
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'user-managed', email: 'comunidad@igda.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-managed', displayName: 'Comunidad' },
      memberships: [{ communityId: 'igda-peru', communityName: 'IGDA Perú', communitySlug: 'igda-peru', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app/eventos']}><ManagedEventsPage /></MemoryRouter></AuthContext.Provider>)

    const activeSection = await screen.findByRole('region', { name: 'Eventos activos' })
    const archivedSection = screen.getByRole('region', { name: 'Eventos archivados' })
    expect(within(activeSection).getByText('Evento próximo del panel')).toBeInTheDocument()
    expect(within(activeSection).getByText('Evento pasado activo')).toBeInTheDocument()
    expect(within(activeSection).queryByText('Evento archivado')).not.toBeInTheDocument()
    expect(within(archivedSection).getByText('Evento archivado')).toBeInTheDocument()
    expect(within(archivedSection).getByText('Archivado')).toBeInTheDocument()
    expect(within(archivedSection).queryByText('Ya pasó')).not.toBeInTheDocument()
    listManagedEventsSpy.mockRestore()
  })
})

describe('community onboarding', () => {
  it('shows the branding setup prompt once for an unconfigured community admin', async () => {
    window.localStorage.clear()
    const authValue = {
      configured: false,
      loading: false,
      session: null,
      user: { id: 'setup-user', email: 'admin@comunidad.pe' } as NonNullable<AuthContextValue['user']>,
      profile: { id: 'profile-setup', displayName: 'Admin' },
      memberships: [{ communityId: 'setup-community', communityName: 'Comunidad Demo', communitySlug: 'comunidad-demo', role: 'community_admin', status: 'active' }],
      roles: ['community_admin'],
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshUserData: vi.fn().mockResolvedValue(undefined),
    } as AuthContextValue

    const view = render(<AuthContext.Provider value={authValue}><MemoryRouter><CommunitySetupPrompt /></MemoryRouter></AuthContext.Provider>)

    expect(await screen.findByRole('dialog', { name: 'Configura Comunidad Demo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Color de la comunidad')).toHaveValue('#d82028')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Configura Comunidad Demo' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('igdaperu:community-setup-seen:setup-user:setup-community')).toBe('1')

    view.rerender(<AuthContext.Provider value={authValue}><MemoryRouter><CommunitySetupPrompt /></MemoryRouter></AuthContext.Provider>)
    expect(screen.queryByRole('dialog', { name: 'Configura Comunidad Demo' })).not.toBeInTheDocument()
  })
})
