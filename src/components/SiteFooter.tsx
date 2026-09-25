import { Link } from 'react-router-dom'
import { useLocale, withLocale } from '../i18n'

export function SiteFooter() {
  const { locale, t } = useLocale()
  const mainSite = (path: string) => `https://igda.pe${withLocale(path, locale)}`
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-header">
          <div className="footer-branding">
            <img className="footer-logo" src="/brand/igda-peru-footer-mark.svg" alt="" width="100" height="88" />
            <div className="footer-brand-copy">
              <h2 className="footer-brand-title"><img src="/brand/igda-peru-footer-wordmark.svg" alt="IGDA Peru" width="155" height="34" /></h2>
              <p>{t('footer.description')}</p>
            </div>
          </div>
        </div>
        <div className="site-footer-grid">
          <nav className="footer-group" aria-label={t('footer.about')}>
            <h3>{t('footer.about')}</h3>
            <ul className="footer-group-links">
              <li><a href={mainSite('/')}>{t('site.main')}</a></li>
              <li><a href={mainSite('/equipo/')}>{t('footer.team')}</a></li>
              <li><a href="https://igda.org/">{t('footer.igdaHq')}</a></li>
            </ul>
          </nav>
          <nav className="footer-group" aria-label={t('footer.explore')}>
            <h3>{t('footer.explore')}</h3>
            <ul className="footer-group-links">
              <li><Link to={withLocale('/', locale)}>{t('nav.events')}</Link></li>
              <li><Link to={withLocale('/calendario', locale)}>{t('nav.calendar')}</Link></li>
              <li><Link to={withLocale('/proponer-evento', locale)}>{t('nav.publish')}</Link></li>
            </ul>
          </nav>
          <nav className="footer-group" aria-label={t('footer.ecosystem')}>
            <h3>{t('footer.ecosystem')}</h3>
            <ul className="footer-group-links">
              <li><a href="https://igda.pe/industry/juegos/">{t('footer.gamesPeru')}</a></li>
              <li><Link to={withLocale('/comunidades', locale)}>{t('nav.communities')}</Link></li>
              <li><a href={mainSite('/comunidad/')}>{t('footer.igdaCommunity')}</a></li>
              <li><a href={mainSite('/industry/dir-prof/')}>{t('footer.directory')}</a></li>
            </ul>
          </nav>
          <nav className="footer-group" aria-label={t('footer.connect')}>
            <h3>{t('footer.connect')}</h3>
            <ul className="footer-group-links">
              <li><a href="https://linktr.ee/igdape" target="_blank" rel="noopener noreferrer">Linktree</a></li>
              <li><a href={mainSite('/contacto/')}>{t('footer.contact')}</a></li>
              <li><Link to={withLocale('/privacidad', locale)}>{t('footer.privacy')}</Link></li>
            </ul>
          </nav>
        </div>
        <p className="footer-copyright">© {new Date().getFullYear()} IGDA Perú. {t('footer.rights')}</p>
      </div>
    </footer>
  )
}
