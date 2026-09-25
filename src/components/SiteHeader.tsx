import { LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu, Send, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getCommunityLogoUrl } from '../lib/data'
import { localeNames, locales, stripLocaleFromPath, useLocale, withLocale } from '../i18n'

export function SiteHeader({ embed = false }: { embed?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const languageSwitcherRef = useRef<HTMLDetailsElement>(null)
  const { user, memberships, signOut } = useAuth()
  const { locale, setLocale, t } = useLocale()
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

  const currentPath = stripLocaleFromPath(location.pathname)
  const isApp = currentPath.startsWith('/app')
  const isCommunities = currentPath.startsWith('/comunidades')
  const isCalendar = currentPath === '/calendario'
  const isEvents = !isApp && !isCommunities && !isCalendar
  const communitiesPath = withLocale('/comunidad/', locale)
  const communitiesHref = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://127.0.0.1:4321${communitiesPath}`
    : `https://igda.pe${communitiesPath}`
  const closeAccountMenu = () => setAccountMenuOpen(false)
  const accountCommunity = memberships.find((membership) => membership.communityLogoPath) || memberships[0]
  const accountCommunityLogoUrl = getCommunityLogoUrl(accountCommunity?.communityLogoPath)

  return (
    <header className={`site-header ${menuOpen ? 'menu-open' : ''}`}>
      <div className="site-header-inner">
        <div
          className="site-switcher"
          onMouseEnter={() => setSiteSwitcherOpen(true)}
          onMouseLeave={() => setSiteSwitcherOpen(false)}
          onFocus={() => setSiteSwitcherOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSiteSwitcherOpen(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSiteSwitcherOpen(false)
          }}
        >
          <Link className="site-switcher-trigger" to="/" aria-label={t('nav.switchSite')} aria-haspopup="menu" aria-expanded={siteSwitcherOpen} aria-controls="site-switcher-menu">
            <span className="brand">
              <img className="brand-logo" src="/brand/logo-igda-peru.png" alt="" width="56" height="50" />
              <span className="brand-copy"><img className="brand-wordmark" src="/brand/igda-peru-wordmark.svg" alt={t('site.main')} width="112" height="25" /><small>{t('nav.events')}</small></span>
            </span>
          </Link>
          {siteSwitcherOpen && <div className="site-switcher-menu" id="site-switcher-menu" role="menu" aria-label="Sitios de IGDA Perú">
            <a role="menuitem" href={`https://igda.pe${withLocale('/', locale)}`}><strong>{t('site.main')}</strong></a>
            <Link role="menuitem" className="is-active" to="/"><strong>{t('nav.events')}</strong></Link>
            <a role="menuitem" href="https://games.igda.pe/"><strong>{t('site.games')}</strong></a>
          </div>}
        </div>
        <button className="mobile-menu" type="button" aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label={t('nav.main')}>
          <Link className={isEvents ? 'active' : ''} to="/">{t('nav.events')}</Link>
          <a className={isCommunities ? 'active' : ''} href={communitiesHref}>{t('nav.communities')}</a>
          <Link className={isCalendar ? 'active' : ''} to="/calendario">{t('nav.calendar')}</Link>
        </nav>
        <div className="header-actions">
          {!isApp && !user && <Link className="publish-button" to="/proponer-evento" onClick={closeAccountMenu} aria-label={t('nav.publish')} title={t('nav.publish')}><span className="publish-button-label">{t('nav.publish')}</span><Send size={17} aria-hidden="true" /></Link>}
          {user && <Link className="publish-button publish-button--dashboard" to="/app" onClick={closeAccountMenu} aria-label={t('nav.dashboard')}><LayoutDashboard size={19} aria-hidden="true" /><span className="publish-button-label">{t('nav.dashboard')}</span></Link>}
          {user ? (
            <div className="account-menu" ref={accountMenuRef}>
              <button className="account-button" type="button" onClick={() => setAccountMenuOpen(!accountMenuOpen)} title={t('nav.profileMenu')} aria-label={t('nav.profileMenu')} aria-haspopup="menu" aria-expanded={accountMenuOpen} aria-controls="account-menu">
                {accountCommunityLogoUrl ? <img src={accountCommunityLogoUrl} alt="" /> : <span>{(user.email || 'U').slice(0, 1).toUpperCase()}</span>}
              </button>
              {accountMenuOpen && <div className="account-dropdown" id="account-menu" role="menu" aria-label="Opciones de perfil">
                <Link role="menuitem" to="/app/editar-perfil" onClick={closeAccountMenu}><User size={16} aria-hidden="true" /> {t('account.editProfile')}</Link>
                <Link role="menuitem" to="/app/cambiar-contrasena" onClick={closeAccountMenu}><LockKeyhole size={16} aria-hidden="true" /> {t('account.changePassword')}</Link>
                <button role="menuitem" type="button" onClick={() => { closeAccountMenu(); void signOut() }}><LogOut size={16} aria-hidden="true" /> {t('account.signOut')}</button>
              </div>}
            </div>
          ) : (
            <Link className="login-link" to="/login" aria-label={t('nav.login')} title={t('nav.login')}><LogIn size={17} aria-hidden="true" /><span>{t('nav.login')}</span></Link>
          )}
          <details className="language-switcher" ref={languageSwitcherRef}>
            <summary aria-label={t('nav.languageName', { name: localeNames[locale] })} title={t('nav.changeLanguage')}>
              <span className={`language-switcher__flag language-switcher__flag--${locale}`} aria-hidden="true" />
              {locale.toUpperCase()}
            </summary>
            <div className="language-switcher__menu" role="menu" aria-label={t('nav.selectLanguage')}>
              {locales.map((option) => {
                const href = `${withLocale(location.pathname, option)}${location.search}${location.hash}`
                return <a
                  key={option}
                  href={href}
                  className={`language-switcher__option${option === locale ? ' is-active' : ''}`}
                  role="menuitem"
                  aria-current={option === locale ? 'page' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    languageSwitcherRef.current?.removeAttribute('open')
                    setLocale(option)
                    setMenuOpen(false)
                  }}
                >
                  <span className={`language-switcher__flag language-switcher__flag--${option}`} aria-hidden="true" />
                  {localeNames[option]}
                </a>
              })}
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}

export function LogoMark() {
  return <span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>Eventos IGDA Perú</span></span>
}
