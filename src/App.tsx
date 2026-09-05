import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { SiteFooter } from './components/SiteFooter'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SiteHeader } from './components/SiteHeader'
import { LoadingState } from './components/Feedback'
import { AcceptInvitationPage, AuthCallbackPage, ChangePasswordPage, EditProfilePage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { CommunityDetailPage, CommunitiesPage, EmbedPage, HomeEventsEmbedPage, PublicAgendaPage } from './pages/PublicPages'
import { CommunityEventsPage, CommunitySettingsPage, DashboardPage, EventEditorPage, ManagedEventsPage, PlatformAdminPage } from './pages/AppPages'
import { ConversationsPage } from './pages/ChatPage'

function PublicLayout() {
  return <><SiteHeader /><main className="site-main"><Outlet /></main><SiteFooter /></>
}

function AppLayout() {
  return <><SiteHeader /><main className="site-main"><Outlet /></main></>
}

function PrivacyPage() {
  return <div className="legal-page"><h1>Privacidad</h1><p>El servicio utiliza una cuenta de email solo para autenticarte y permitirte consultar eventos de la red o administrar una comunidad mediante invitación.</p><p>Los eventos públicos pueden aparecer en Eventos IGDA Perú y en integraciones externas. Los eventos de red solo están disponibles para usuarios autenticados.</p><p>Antes del lanzamiento público completaremos la información legal de la organización responsable y los canales para ejercer derechos.</p></div>
}

function App() {
  return <BrowserRouter><AuthProvider><Routes><Route element={<PublicLayout />}><Route path="/" element={<PublicAgendaPage />} /><Route path="/comunidades" element={<CommunitiesPage />} /><Route path="/comunidades/:slug" element={<CommunityDetailPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/registro" element={<RegisterPage />} /><Route path="/recuperar" element={<ForgotPasswordPage />} /><Route path="/restablecer" element={<ResetPasswordPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/invitaciones/:token" element={<AcceptInvitationPage />} /><Route path="/privacidad" element={<PrivacyPage />} /></Route><Route path="/embed/inicio" element={<HomeEventsEmbedPage />} /><Route path="/embed" element={<EmbedPage />} /><Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route path="/app" element={<DashboardPage />} /><Route path="/app/eventos" element={<ManagedEventsPage />} /><Route path="/app/eventos/comunidad" element={<CommunityEventsPage />} /><Route path="/app/conversaciones" element={<ConversationsPage />} /><Route path="/app/eventos/nuevo" element={<EventEditorPage />} /><Route path="/app/eventos/:eventId" element={<EventEditorPage />} /><Route path="/app/editar-perfil" element={<EditProfilePage />} /><Route path="/app/cambiar-contrasena" element={<ChangePasswordPage />} /><Route path="/app/comunidad" element={<CommunitySettingsPage />} /><Route path="/app/admin" element={<PlatformAdminPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></AuthProvider></BrowserRouter>
}

export function AppLoading() { return <LoadingState /> }
export default App
