import { LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function SiteHeader({ embed = false }: { embed?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const { user, signOut } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!accountMenuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [accountMenuOpen])

  if (embed) return null

  const isApp = location.pathname.startsWith('/app')
  const closeAccountMenu = () => setAccountMenuOpen(false)

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
        </nav>
        <div className="header-actions">
          {user && <Link className="publish-button" to="/app" onClick={closeAccountMenu}><LayoutDashboard size={19} aria-hidden="true" /> Panel</Link>}
          {user ? (
            <div className="account-menu" ref={accountMenuRef}>
              <button className="account-button" type="button" onClick={() => setAccountMenuOpen(!accountMenuOpen)} title="Menú de perfil" aria-label="Abrir menú de perfil" aria-haspopup="menu" aria-expanded={accountMenuOpen} aria-controls="account-menu">
                <span>{(user.email || 'U').slice(0, 1).toUpperCase()}</span>
              </button>
              {accountMenuOpen && <div className="account-dropdown" id="account-menu" role="menu" aria-label="Opciones de perfil">
                <Link role="menuitem" to="/app/cambiar-contrasena" onClick={closeAccountMenu}><LockKeyhole size={16} aria-hidden="true" /> Cambiar contraseña</Link>
                <button role="menuitem" type="button" onClick={() => { closeAccountMenu(); void signOut() }}><LogOut size={16} aria-hidden="true" /> Cerrar sesión</button>
              </div>}
            </div>
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
