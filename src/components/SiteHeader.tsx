import { LogIn, Menu, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function SiteHeader({ embed = false }: { embed?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, memberships, signOut } = useAuth()
  const location = useLocation()
  if (embed) return null

  const isApp = location.pathname.startsWith('/app')

  return (
    <header className={`site-header ${menuOpen ? 'menu-open' : ''}`}>
      <div className="site-header-inner">
        <Link className="brand" to="/" aria-label="Eventos IGDA Perú, inicio">
          <img className="brand-logo" src="/brand/logo-igda-peru.png" alt="" width="56" height="50" />
          <span className="brand-copy"><span className="brand-name">IGDA Peru</span><small>Eventos</small></span>
        </Link>
        <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Navegación principal">
          <Link className={!isApp && location.pathname !== '/comunidades' ? 'active' : ''} to="/">Eventos</Link>
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
      </div>
    </header>
  )
}

export function LogoMark() {
  return <span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>Eventos IGDA Perú</span></span>
}
