import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { SiteFooter } from './components/SiteFooter'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SiteHeader } from './components/SiteHeader'
import { LoadingState } from './components/Feedback'
import { AcceptInvitationPage, AuthCallbackPage, ChangePasswordPage, EditProfilePage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { CalendarAccessPage, CommunityDetailPage, CommunitiesPage, EmbedPage, EventProposalPage, HomeEventsEmbedPage, HomePage, SpotlightEventsEmbedPage } from './pages/PublicPages'
import { CommunityEventsPage, CommunitySettingsPage, DashboardPage, EventEditorPage, EventProposalsPage, ManagedEventsPage, PlatformAdminPage } from './pages/AppPages'
import { ConversationsPage } from './pages/ChatPage'
import { CommunitySetupPrompt } from './components/CommunitySetupPrompt'

function PublicLayout() {
  return <><SiteHeader /><main className="site-main"><Outlet /></main><SiteFooter /></>
}

function AppLayout() {
  return <><SiteHeader /><main className="site-main"><Outlet /></main><CommunitySetupPrompt /></>
}

export function PrivacyPage() {
  return <div className="legal-page privacy-page">
    <header className="legal-page-header">
      <div>
        <span className="legal-page-kicker">Información legal</span>
        <h1>Privacidad</h1>
        <p className="legal-page-lead">Queremos que sepas qué información usamos para que Eventos IGDA Perú funcione y cómo se muestra la información de las comunidades.</p>
      </div>
      <div className="legal-page-meta"><strong>Versión preliminar</strong><span>Septiembre de 2026</span></div>
    </header>

    <div className="privacy-policy-layout">
      <aside className="privacy-policy-summary" aria-label="Resumen de la política">
        <span>En resumen</span>
        <p>Usamos los datos necesarios para autenticar cuentas, administrar comunidades y publicar eventos según su nivel de visibilidad.</p>
        <nav aria-label="Secciones de privacidad">
          <a href="#datos">Datos que usamos</a>
          <a href="#usos">Cómo los usamos</a>
          <a href="#visibilidad">Contenido público</a>
          <a href="#solicitudes">Solicitudes y contacto</a>
        </nav>
      </aside>

      <main className="privacy-policy-content">
        <section id="alcance" className="privacy-policy-section">
          <span className="privacy-policy-number">01</span>
          <div><h2>Qué cubre esta política</h2><p>Esta información aplica al servicio Eventos IGDA Perú, utilizado para descubrir eventos y para que las comunidades administren sus actividades mediante invitación.</p></div>
        </section>
        <section id="datos" className="privacy-policy-section">
          <span className="privacy-policy-number">02</span>
          <div><h2>Datos que podemos usar</h2><ul><li><strong>Cuenta y acceso:</strong> correo electrónico, perfil y datos necesarios para autenticarte.</li><li><strong>Comunidades y eventos:</strong> nombres, descripciones, fechas, lugares, enlaces, imágenes y propuestas que una persona o comunidad decide registrar.</li><li><strong>Protección del servicio:</strong> información técnica necesaria para proteger formularios, prevenir abusos y mantener la plataforma operativa.</li></ul></div>
        </section>
        <section id="usos" className="privacy-policy-section">
          <span className="privacy-policy-number">03</span>
          <div><h2>Cómo usamos la información</h2><ul><li>Crear y mantener tu acceso a la plataforma.</li><li>Permitir la gestión de comunidades y eventos.</li><li>Mostrar actividades públicas y facilitar la conexión entre comunidades.</li><li>Enviar invitaciones o comunicaciones relacionadas con el servicio.</li><li>Proteger la plataforma frente a abuso, fraude o uso no autorizado.</li></ul></div>
        </section>
        <section id="visibilidad" className="privacy-policy-section">
          <span className="privacy-policy-number">04</span>
          <div><h2>Contenido público e integraciones</h2><p>Los eventos y datos de comunidades configurados como públicos pueden aparecer en Eventos IGDA Perú, en sitios incrustados o en integraciones externas. Los eventos destinados únicamente a la red se muestran solo a personas autenticadas con el acceso correspondiente.</p><p>Según la función utilizada, podemos apoyarnos en servicios como Supabase para autenticación y almacenamiento, Google para mapas, calendario o reuniones, y Cloudflare Turnstile para protección contra spam. Cada proveedor puede aplicar sus propias políticas.</p></div>
        </section>
        <section id="solicitudes" className="privacy-policy-section">
          <span className="privacy-policy-number">05</span>
          <div><h2>Solicitudes y contacto</h2><p>Si necesitas consultar, corregir o solicitar la eliminación de información asociada a tu cuenta, podrás hacerlo a través del canal oficial de contacto de la organización responsable.</p><p className="privacy-policy-muted">El nombre legal de la organización responsable, el correo de contacto y los plazos de conservación deben completarse antes del lanzamiento público.</p></div>
        </section>
        <section className="privacy-policy-section">
          <span className="privacy-policy-number">06</span>
          <div><h2>Cambios a esta política</h2><p>Podemos actualizar esta información cuando cambien el servicio, las integraciones o las obligaciones aplicables. La versión vigente se publicará en esta página con su fecha de actualización.</p></div>
        </section>
      </main>
    </div>

    <aside className="privacy-policy-callout" aria-labelledby="privacy-policy-callout-title"><span className="legal-page-kicker">Antes del lanzamiento público</span><h2 id="privacy-policy-callout-title">Completar la información legal de la organización</h2><p>La estructura ya está preparada. Falta confirmar con la organización responsable el nombre legal, domicilio o jurisdicción, canal de contacto, plazos de conservación y cualquier texto requerido por asesoría legal.</p></aside>
  </div>
}

function App() {
  return <BrowserRouter><AuthProvider><Routes><Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /><Route path="/calendario" element={<CalendarAccessPage />} /><Route path="/proponer-evento" element={<EventProposalPage />} /><Route path="/comunidades" element={<CommunitiesPage />} /><Route path="/comunidades/:slug" element={<CommunityDetailPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/registro" element={<RegisterPage />} /><Route path="/recuperar" element={<ForgotPasswordPage />} /><Route path="/restablecer" element={<ResetPasswordPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/invitaciones/:token" element={<AcceptInvitationPage />} /><Route path="/privacidad" element={<PrivacyPage />} /></Route><Route path="/embed/inicio" element={<HomeEventsEmbedPage />} /><Route path="/embed/spotlight" element={<SpotlightEventsEmbedPage />} /><Route path="/embed" element={<EmbedPage />} /><Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route path="/app" element={<DashboardPage />} /><Route path="/app/eventos" element={<ManagedEventsPage />} /><Route path="/app/eventos/comunidad" element={<CommunityEventsPage />} /><Route path="/app/conversaciones" element={<ConversationsPage />} /><Route path="/app/eventos/nuevo" element={<EventEditorPage />} /><Route path="/app/eventos/:eventId" element={<EventEditorPage />} /><Route path="/app/editar-perfil" element={<EditProfilePage />} /><Route path="/app/cambiar-contrasena" element={<ChangePasswordPage />} /><Route path="/app/comunidad" element={<CommunitySettingsPage />} /><Route path="/app/admin" element={<PlatformAdminPage />} /><Route path="/app/admin/propuestas" element={<EventProposalsPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider></BrowserRouter>
}

export function AppLoading() { return <LoadingState /> }
export default App
