import { Link } from 'react-router-dom'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-header">
          <div className="footer-branding">
            <img className="footer-logo" src="/brand/igda-peru-footer-mark.svg" alt="" width="100" height="88" />
            <div className="footer-brand-copy">
              <h2 className="footer-brand-title"><img src="/brand/igda-peru-footer-wordmark.svg" alt="IGDA Peru" width="155" height="34" /></h2>
              <p>Un espacio para conectar a las comunidades que crean videojuegos en Perú.</p>
            </div>
          </div>
        </div>
        <div className="site-footer-grid">
          <nav className="footer-group" aria-label="Nosotros">
            <h3>Nosotros</h3>
            <a href="https://igda.pe" target="_blank" rel="noreferrer">IGDA Perú</a>
          </nav>
          <nav className="footer-group" aria-label="Explorar">
            <h3>Explorar</h3>
            <Link to="/">Eventos</Link>
          </nav>
          <nav className="footer-group" aria-label="Ecosistema">
            <h3>Ecosistema</h3>
            <Link to="/comunidades">Comunidades</Link>
          </nav>
          <nav className="footer-group" aria-label="Conecta">
            <h3>Conecta</h3>
            <Link to="/privacidad">Privacidad</Link>
          </nav>
        </div>
        <p className="footer-copyright">© {new Date().getFullYear()} IGDA Perú. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
