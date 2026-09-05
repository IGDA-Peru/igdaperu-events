import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from './auth/auth-context'
import App from './App'
import { SiteHeader } from './components/SiteHeader'
import { CommunityEventsPage, CommunitySettingsPage, DashboardPage, EventEditorPage } from './pages/AppPages'
import { ConversationsPage } from './pages/ChatPage'
import { CommunityDetailPage } from './pages/PublicPages'

vi.mock('./lib/supabase', () => ({
  appUrl: 'http://localhost:5173',
  isSupabaseConfigured: false,
  supabase: null,
}))

describe('public events', () => {
  it('shows public events using the local demo fallback', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Agenda IGDA Perú' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Publicar evento/ })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Tiempo' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lugar' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lugar' })).toHaveValue('all')
    expect(screen.queryByRole('option', { name: 'Todos los departamentos del Perú' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Internacional' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lima' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ver Diseño de niveles/ }).length).toBeGreaterThan(0))
    expect(screen.getByText(/Vista de demostración/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Comunidades/ }).length).toBeGreaterThan(0)
    expect(document.querySelector('.community-arrow')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Ver Diseño de niveles/ })[0])
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
    expect(screen.getByText('Fecha')).toBeInTheDocument()
    expect(screen.queryByText('Reportar este evento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
    expect(screen.queryByRole('dialog', { name: /Diseño de niveles/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }))
    expect(screen.getByRole('region', { name: /Calendario/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Diseño de niveles/ }))
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))

    fireEvent.click(screen.getByRole('button', { name: 'Línea de tiempo' }))
    expect(screen.getByRole('region', { name: /Línea de tiempo/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Diseño de niveles/ }))
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
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

  it('redirects legacy event URLs back to the agenda', async () => {
    window.history.pushState({}, '', '/eventos/diseno-de-niveles')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('shows the community logo and main website in the community header', async () => {
    render(<AuthContext.Provider value={{ configured: false, loading: false, session: null, user: null, profile: null, memberships: [], roles: [], signOut: vi.fn().mockResolvedValue(undefined), refreshUserData: vi.fn().mockResolvedValue(undefined) }}><MemoryRouter initialEntries={['/comunidades/igda-peru']}><Routes><Route path="/comunidades/:slug" element={<CommunityDetailPage />} /></Routes></MemoryRouter></AuthContext.Provider>)

    expect(await screen.findByRole('heading', { name: 'IGDA Perú' })).toBeInTheDocument()
    expect(document.querySelector('.community-hero img')).toHaveAttribute('src', '/brand/logo-igda-peru.png')
    expect(screen.getByRole('link', { name: /Visitar sitio principal/ })).toHaveAttribute('href', 'https://igda.pe')
  })

  it('organizes the manager dashboard around communities and events', () => {
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
    expect(screen.getByRole('heading', { name: 'Hola, Comunidad' })).toBeInTheDocument()
    expect(screen.getByText('Tu comunidad')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tus eventos' })).toBeInTheDocument()
    expect(document.querySelector('.dashboard-community-panel')).toBeInTheDocument()
    expect(document.querySelector('.dashboard-sidebar .dashboard-chat-summary')).toBeInTheDocument()
    expect(document.querySelector('.dashboard-community-panel')?.nextElementSibling).toHaveClass('dashboard-chat-summary')
    expect(document.querySelector('.dashboard-grid--with-chat')?.children).toHaveLength(2)
    expect(document.querySelector('.account-button img')).toHaveAttribute('src', '/brand/logo-igda-peru.png')
    expect(screen.getByRole('link', { name: /Nuevo evento/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver todos/ })).not.toBeInTheDocument()
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
    expect(await screen.findByRole('combobox', { name: 'Comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Correos registrados' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Información pública' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: 'Correos registrados' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Invitar editor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar invitación' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Información pública' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Información pública' }))
    expect(screen.getByRole('heading', { name: 'Información pública' })).toBeInTheDocument()
    expect(screen.getByText(/heredados desde Google Sheets/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Logo de la comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo de IGDA Perú' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actualizar logo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Invitar persona' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Descripción' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
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

  it('lets authenticated users browse the community event network from the panel', async () => {
    render(<MemoryRouter initialEntries={['/app/eventos/comunidad']}><CommunityEventsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Eventos de la comunidad' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Eventos de la comunidad' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('button', { name: /Ver Introducción a Godot Engine/ })).toBeInTheDocument()
    expect(screen.getByText('Comunidad Godot Lima')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Línea de tiempo' }))
    expect(screen.getByRole('region', { name: /Línea de tiempo/ })).toBeInTheDocument()
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
    expect(screen.getByText(/recomendado 1600 × 900/)).toBeInTheDocument()
    expect(document.querySelector('.event-banner-dropzone')).toBeInTheDocument()
    const summaryToggle = screen.getByRole('button', { name: 'Resumen' })
    expect(summaryToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(summaryToggle)
    expect(summaryToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('complementary', { name: 'Resumen del evento' })).toBeInTheDocument()
    expect(screen.getByText('Borrador / Red privada')).toBeInTheDocument()
    expect(screen.getByText('Falta:')).toBeInTheDocument()
    expect(screen.queryByText('El banner es opcional para cualquiera de las tres opciones.')).not.toBeInTheDocument()
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
    expect(screen.getByRole('tab', { name: /Ubicación y Acceso/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { name: /Ubicación y acceso/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Nombre del lugar')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Buscar lugar o dirección')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /No encuentro el lugar/ })).toBeInTheDocument()
    expect(document.querySelector('.summary-location-access')).toBeInTheDocument()
    expect(screen.getByText('Acceso')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Enlace de Google Maps/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Abrir Google Maps/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Selecciona el punto exacto')).not.toBeInTheDocument()
    expect(screen.queryByText('Enlace para unirse')).not.toBeInTheDocument()
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
