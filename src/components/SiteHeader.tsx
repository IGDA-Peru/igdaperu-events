import { CalendarDays, LogIn, Menu, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function SiteHeader({ embed = false }: { embed?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, memberships, signOut } = useAuth()
  const location = useLocation()
  if (embed) return null

  const isApp = location.pathname.startsWith('/app')

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Agenda IGDA Perú, inicio">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span className="brand-name">igda<small>Perú</small></span>
      </Link>
      <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Navegación principal">
        <Link className={!isApp && location.pathname !== '/comunidades' ? 'active' : ''} to="/">Agenda</Link>
        <Link className={location.pathname.startsWith('/comunidades') ? 'active' : ''} to="/comunidades">Comunidades</Link>
        {user && memberships.length > 0 && <Link className={isApp ? 'active' : ''} to="/app">Panel</Link>}
      </nav>
      <div className="header-actions">
        <Link className="publish-button" to={user && memberships.length > 0 ? '/app/eventos/nuevo' : '/login'}>
          <Plus size={20} aria-hidden="true" /> Publicar evento
        </Link>
        {user ? (
          <button className="account-button" type="button" onClick={() => void signOut()} title="Cerrar sesión">
            <span>{(user.email || 'U').slice(0, 1).toUpperCase()}</span>
          </button>
        ) : (
          <Link className="login-link" to="/login"><LogIn size={17} /> Ingresar</Link>
        )}
      </div>
    </header>
  )
}

export function LogoMark() {
  return <span className="compact-brand"><CalendarDays size={18} /> Agenda IGDA Perú</span>
}
