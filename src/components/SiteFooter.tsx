import { Link } from 'react-router-dom'

export function SiteFooter() {
  return <footer className="site-footer"><div><span className="compact-brand">Agenda IGDA Perú</span><p>Una agenda para conectar a las comunidades que crean videojuegos en Perú.</p></div><div className="footer-links"><Link to="/">Agenda</Link><Link to="/comunidades">Comunidades</Link><Link to="/privacidad">Privacidad</Link><a href="https://igdaperu.org" target="_blank" rel="noreferrer">IGDA Perú</a></div></footer>
}
