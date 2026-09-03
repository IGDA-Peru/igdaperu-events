import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { DemoNotice } from '../components/Feedback'
import { appUrl, supabase } from '../lib/supabase'

function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="auth-page"><div className="auth-card"><Link className="auth-brand" to="/"><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-name">igda<small>Perú</small></span></Link><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></div>
}

function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null
  return <p className={`form-message ${error ? 'error' : 'success'}`} role="alert">{error || success}</p>
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const from = (location.state as { from?: string } | null)?.from || searchParams.get('next') || '/app'

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Supabase aún no está configurado para este entorno.'); return }
    setLoading(true)
    const result = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else navigate(from, { replace: true })
  }

  return <AuthFrame title="Ingresar" description="Accede a la red de comunidades y gestiona tus eventos.">{!configured && <DemoNotice />}<form className="auth-form" onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><FormMessage error={error} /><button className="primary-button full" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button></form><div className="auth-links"><Link to="/registro">¿Tienes una invitación?</Link><Link to="/recuperar">Olvidé mi contraseña</Link></div></AuthFrame>
}

export function RegisterPage() {
  return <AuthFrame title="Acceso por invitación" description="La creación de cuentas está reservada para personas invitadas por una comunidad.">
    <div className="success-panel"><ShieldCheck size={31} /><p>Para participar en una comunidad, un administrador debe enviarte una invitación por correo.</p><p>Abre ese enlace para confirmar tu correo y definir tu contraseña.</p></div>
    <div className="auth-links"><Link to="/login">Ya tengo una cuenta</Link><Link to="/">Volver a la agenda</Link></div>
  </AuthFrame>
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('')
    if (!supabase) { setError('Supabase aún no está configurado para este entorno.'); return }
    setLoading(true)
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/restablecer` })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else setSuccess('Si existe una cuenta con ese email, recibirás instrucciones para restablecer tu contraseña.')
  }
  return <AuthFrame title="Recuperar contraseña" description="Te enviaremos un enlace seguro para crear una nueva contraseña."><form className="auth-form" onSubmit={submit}><label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><FormMessage error={error} success={success} /><button className="primary-button full" disabled={loading}>{loading ? 'Enviando…' : 'Enviar instrucciones'}</button></form><div className="auth-links"><Link to="/login"><ArrowLeft size={15} /> Volver a ingresar</Link></div></AuthFrame>
}

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Supabase aún no está configurado para este entorno.'); return }
    const result = await supabase.auth.updateUser({ password })
    if (result.error) setError(result.error.message)
    else setSuccess(true)
  }
  return <AuthFrame title="Nueva contraseña" description="Elige una contraseña nueva para proteger tu cuenta.">{success ? <div className="success-panel"><CheckCircle2 size={31} /><p>Tu contraseña fue actualizada.</p><button className="primary-button full" type="button" onClick={() => navigate('/app')}>Ir al panel</button></div> : <form className="auth-form" onSubmit={submit}><label>Nueva contraseña<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><FormMessage error={error} /><button className="primary-button full">Guardar contraseña</button></form>}</AuthFrame>
}

export function AcceptInvitationPage() {
  const { token = '' } = useParams()
  const { user, configured, refreshUserData } = useAuth()
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase || !user) { setError('Abre el enlace desde el correo de invitación para continuar.'); return }
    setLoading(true)
    const update = await supabase.auth.updateUser({ password, data: { display_name: displayName } })
    if (update.error) { setLoading(false); setError(update.error.message); return }
    const result = await supabase.functions.invoke('accept-invitation', { body: { token } })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else { await refreshUserData(); setSuccess(true) }
  }

  return <AuthFrame title="Aceptar invitación" description="Completa tu perfil para administrar eventos de una comunidad.">{!configured && <DemoNotice />}{!user ? <div className="invite-login"><ShieldCheck size={32} /><p>Confirma primero tu cuenta desde el enlace que recibiste por correo.</p><Link className="primary-button full" to={`/login?next=${encodeURIComponent(`/invitaciones/${token}`)}`}>Ingresar</Link></div> : success ? <div className="success-panel"><CheckCircle2 size={31} /><p>Invitación aceptada. Ya puedes gestionar eventos.</p><Link className="primary-button full" to="/app">Ir al panel</Link></div> : <form className="auth-form" onSubmit={submit}><label>Nombre visible<input type="text" required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Contraseña<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><FormMessage error={error} /><button className="primary-button full" disabled={loading}>{loading ? 'Activando acceso…' : 'Aceptar invitación'}</button></form>}</AuthFrame>
}

export function AuthCallbackPage() {
  return <AuthFrame title="Cuenta confirmada" description="Tu sesión está lista. Ya puedes volver a la agenda."><div className="success-panel"><Mail size={31} /><p>La confirmación de correo terminó correctamente.</p><Link className="primary-button full" to="/app"><LockKeyhole size={17} /> Ir al panel</Link></div></AuthFrame>
}
