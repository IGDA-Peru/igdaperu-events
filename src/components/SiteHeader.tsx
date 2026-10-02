import { LayoutDashboard, LockKeyhole, LogIn, LogOut, Menu, Send, Sun, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getCommunityLogoUrl } from '../lib/data'
import { localeNames, locales, stripLocaleFromPath, useLocale, withLocale } from '../i18n'
import { getThemePreference, setThemePreference, subscribeToThemePreference, type ThemePreference } from '../lib/theme-preference'

function LanguageControl({ onCloseMenu }: { onCloseMenu: () => void }) {
  const controlRef = useRef<HTMLDetailsElement>(null)
  const { locale, setLocale, t } = useLocale()
  const location = useLocation()

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (controlRef.current && !controlRef.current.contains(event.target as Node)) controlRef.current.removeAttribute('open')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && controlRef.current?.open) {
        controlRef.current.removeAttribute('open')
        controlRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const close = () => {
    controlRef.current?.removeAttribute('open')
    onCloseMenu()
  }

  return <details className="header-control header-control--language" ref={controlRef} data-language-control>
    <summary role="button" aria-label={t('settings.language')} title={t('settings.language')} aria-controls="language-control-panel">
      <span className={`language-switcher__flag language-switcher__flag--${locale}`} aria-hidden="true" />
    </summary>
    <div className="header-control__panel" id="language-control-panel">
      <fieldset className="header-control__group">
        <legend>{t('settings.language')}</legend>
        <div className="header-control__options">
          {locales.map((option) => {
            const href = `${withLocale(location.pathname, option)}${location.search}${location.hash}`
            return <a
              key={option}
              href={href}
              className={`header-control__option${option === locale ? ' is-active' : ''}`}
              aria-current={option === locale ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                close()
                setLocale(option)
              }}
            >
              <span className={`language-switcher__flag language-switcher__flag--${option}`} aria-hidden="true" />
              {localeNames[option]}
            </a>
          })}
        </div>
      </fieldset>
    </div>
  </details>
}

function AppearanceControl({ themePreference, onCloseMenu }: { themePreference: ThemePreference; onCloseMenu: () => void }) {
  const controlRef = useRef<HTMLDetailsElement>(null)
  const { t } = useLocale()

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (controlRef.current && !controlRef.current.contains(event.target as Node)) controlRef.current.removeAttribute('open')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && controlRef.current?.open) {
        controlRef.current.removeAttribute('open')
        controlRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const close = () => {
    controlRef.current?.removeAttribute('open')
    onCloseMenu()
  }

  return <details className="header-control header-control--appearance" ref={controlRef} data-appearance-control>
    <summary role="button" aria-label={t('settings.appearance')} title={t('settings.appearance')} aria-controls="appearance-control-panel">
      <Sun size={19} aria-hidden="true" />
    </summary>
    <div className="header-control__panel" id="appearance-control-panel">
      <fieldset className="header-control__group">
        <legend>{t('settings.appearance')}</legend>
        <div className="header-control__options">
          {(['system', 'light', 'dark'] as const).map((option) => (
            <label className="header-control__option header-control__theme-option" htmlFor={`events-theme-${option}`} key={option}>
              <input
                id={`events-theme-${option}`}
                type="radio"
                name="events-theme-preference"
                value={option}
                checked={themePreference === option}
                onChange={() => {
                  setThemePreference(option)
                  close()
                }}
              />
              <span>{t(`settings.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  </details>
}

export function SiteHeader({ embed = false }: { embed?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false)
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getThemePreference())
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const { user, memberships, signOut } = useAuth()
  const { locale, t } = useLocale()
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

  useEffect(() => subscribeToThemePreference(setThemePreferenceState), [])

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus()
    }

    const closeOnWideViewport = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false)
    }
    const wideViewport = window.matchMedia('(min-width: 1025px)')

    document.addEventListener('keydown', closeOnEscape)
    wideViewport.addEventListener('change', closeOnWideViewport)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      wideViewport.removeEventListener('change', closeOnWideViewport)
    }
  }, [menuOpen])

  useEffect(() => setMenuOpen(false), [location.pathname])

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
      {menuOpen && <button className="mobile-menu-backdrop" type="button" tabIndex={-1} aria-hidden="true" aria-label={t('nav.closeMenu')} onClick={() => setMenuOpen(false)} />}
      <div className="site-header-inner">
        <div
          className="brand-switcher site-switcher"
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
          <Link className="site-switcher-trigger" to="/" aria-label={t('nav.switchSite')} aria-expanded={siteSwitcherOpen} aria-controls="site-switcher-menu">
            <span className="brand">
              <img className="brand-logo" src="/brand/logo-igda-peru.png" alt="" width="56" height="50" />
              <span className="brand-copy"><img className="brand-wordmark" src="/brand/igda-peru-wordmark.svg" alt={t('site.main')} width="112" height="25" /><small>{t('nav.events')}</small></span>
            </span>
          </Link>
          {siteSwitcherOpen && <nav className="brand-switcher-menu site-switcher-menu" id="site-switcher-menu" aria-label="Sitios de IGDA Perú">
            <a href={`https://igda.pe${withLocale('/', locale)}`}>{t('site.main')}</a>
            <Link className="is-current" to="/" aria-current="page">{t('nav.events')}</Link>
            <a href="https://games.igda.pe/#juegos">{t('site.games')}</a>
          </nav>}
        </div>
        <button className="mobile-menu" type="button" aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')} aria-controls="events-mobile-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav id="events-mobile-navigation" className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label={t('nav.main')}>
          <div className="mobile-menu-heading">
            <button className="mobile-menu-close" type="button" aria-label={t('nav.closeMenu')} onClick={() => setMenuOpen(false)}><X size={28} aria-hidden="true" /></button>
          </div>
          <Link className={isEvents ? 'active' : ''} to="/" onClick={() => setMenuOpen(false)}>{t('nav.events')}</Link>
          <a className={isCommunities ? 'active' : ''} href={communitiesHref} onClick={() => setMenuOpen(false)}>{t('nav.communities')}</a>
          <Link className={isCalendar ? 'active' : ''} to="/calendario" onClick={() => setMenuOpen(false)}>{t('nav.calendar')}</Link>
          <div className="header-actions">
            {!isApp && !user && <Link className="publish-button" to="/proponer-evento" onClick={() => { closeAccountMenu(); setMenuOpen(false) }} aria-label={t('nav.publish')} title={t('nav.publish')}><span className="publish-button-label">{t('nav.publish')}</span><Send size={17} aria-hidden="true" /></Link>}
            {user && <Link className="publish-button publish-button--dashboard" to="/app" onClick={() => { closeAccountMenu(); setMenuOpen(false) }} aria-label={t('nav.dashboard')}><LayoutDashboard size={19} aria-hidden="true" /><span className="publish-button-label">{t('nav.dashboard')}</span></Link>}
            {user ? (
              <div className="account-menu" ref={accountMenuRef}>
                <button className="account-button" type="button" onClick={() => setAccountMenuOpen(!accountMenuOpen)} title={t('nav.profileMenu')} aria-label={t('nav.profileMenu')} aria-haspopup="menu" aria-expanded={accountMenuOpen} aria-controls="account-menu">
                  {accountCommunityLogoUrl ? <img src={accountCommunityLogoUrl} alt="" /> : <span>{(user.email || 'U').slice(0, 1).toUpperCase()}</span>}
                </button>
                {accountMenuOpen && <div className="account-dropdown" id="account-menu" role="menu" aria-label="Opciones de perfil">
                  <Link role="menuitem" to="/app/editar-perfil" onClick={() => { closeAccountMenu(); setMenuOpen(false) }}><User size={16} aria-hidden="true" /> {t('account.editProfile')}</Link>
                  <Link role="menuitem" to="/app/cambiar-contrasena" onClick={() => { closeAccountMenu(); setMenuOpen(false) }}><LockKeyhole size={16} aria-hidden="true" /> {t('account.changePassword')}</Link>
                  <button role="menuitem" type="button" onClick={() => { closeAccountMenu(); setMenuOpen(false); void signOut() }}><LogOut size={16} aria-hidden="true" /> {t('account.signOut')}</button>
                </div>}
              </div>
            ) : (
              <Link className="login-link" to="/login" onClick={() => setMenuOpen(false)} aria-label={t('nav.login')} title={t('nav.login')}><LogIn size={17} aria-hidden="true" /><span>{t('nav.login')}</span></Link>
            )}
            <LanguageControl onCloseMenu={() => setMenuOpen(false)} />
            <AppearanceControl themePreference={themePreference} onCloseMenu={() => setMenuOpen(false)} />
          </div>
        </nav>
      </div>
    </header>
  )
}

export function LogoMark() {
  return <span className="compact-brand"><img src="/brand/logo-igda-peru.png" alt="" width="30" height="28" /> <span>Eventos IGDA Perú</span></span>
}
