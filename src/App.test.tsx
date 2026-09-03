import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from './auth/auth-context'
import App from './App'
import { SiteHeader } from './components/SiteHeader'
import { DashboardPage, EventEditorPage } from './pages/AppPages'

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

    fireEvent.click(screen.getAllByRole('button', { name: /Ver Diseño de niveles/ })[0])
    expect(screen.getByRole('dialog', { name: /Diseño de niveles/ })).toBeInTheDocument()
    expect(screen.getByText('Fecha')).toBeInTheDocument()
    expect(screen.queryByText('Reportar este evento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }))
    expect(screen.queryByRole('dialog', { name: /Diseño de niveles/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }))
    expect(screen.getByRole('region', { name: /Calendario/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Línea de tiempo' }))
    expect(screen.getByRole('region', { name: 'Línea de tiempo' })).toBeInTheDocument()
  })

  it('embeds the Notion communities directory without the old intro', () => {
    window.history.pushState({}, '', '/comunidades')
    render(<App />)
    expect(screen.getByTitle('Directorio de comunidades IGDA Perú')).toHaveAttribute('src', 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21')
    expect(screen.queryByRole('heading', { name: 'Comunidades' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrirlo en Notion/ })).toHaveAttribute('href', 'https://igdape.notion.site/ebd/3b425d4453e08301bcef018ab661544a?v=12d25d4453e0825883398852a794ef21')
  })

  it('organizes the manager dashboard around communities and events', () => {
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

    render(<AuthContext.Provider value={authValue}><MemoryRouter initialEntries={['/app']}><SiteHeader /><DashboardPage /></MemoryRouter></AuthContext.Provider>)
    const grid = document.querySelector('.dashboard-grid')
    expect(grid?.children[0]).toHaveClass('dashboard-sidebar')
    expect(grid?.children[1]).toHaveClass('dashboard-main')
    expect(screen.getByRole('heading', { name: 'Hola, Comunidad' })).toBeInTheDocument()
    expect(screen.getByText('Tus comunidades')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tus eventos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Nuevo evento/ })).toBeInTheDocument()
    expect(screen.queryByText('Este es tu espacio para consultar y administrar tus eventos.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Panel/ })).toHaveAttribute('href', '/app')
    expect(screen.queryByRole('link', { name: /Publicar evento/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de perfil' }))
    expect(screen.getByRole('menu', { name: 'Opciones de perfil' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Cambiar contraseña/ })).toHaveAttribute('href', '/app/cambiar-contrasena')
    fireEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }))
    expect(authValue.signOut).toHaveBeenCalled()
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

    expect(await screen.findByRole('heading', { name: 'Crear nuevo evento' })).toBeInTheDocument()
    expect(screen.getByText('Información principal')).toBeInTheDocument()
    expect(screen.getByText('Enlace para unirse')).toBeInTheDocument()
    expect(screen.getAllByText('Obligatorio').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Opcional').length).toBeGreaterThan(0)
    expect(screen.queryByText('Los eventos de comunidades aprobadas pueden publicarse directamente.')).not.toBeInTheDocument()
  })
})
