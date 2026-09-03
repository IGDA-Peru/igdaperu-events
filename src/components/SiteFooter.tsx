import { Link } from 'react-router-dom'

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-branding"><img src="/brand/logo-igda-peru.png" alt="IGDA Peru" width="72" height="65" /><div><strong>Eventos IGDA Perú</strong><p>Un espacio para conectar a las comunidades que crean videojuegos en Perú.</p></div></div><nav className="footer-links" aria-label="Enlaces del pie de página"><Link to="/">Eventos</Link><Link to="/comunidades">Comunidades</Link><Link to="/privacidad">Privacidad</Link><a href="https://igda.pe" target="_blank" rel="noreferrer">IGDA Perú</a></nav><p className="footer-copyright">© {new Date().getFullYear()} IGDA Perú. Todos los derechos reservados.</p></footer>
}
