import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { DemoNotice } from '../components/Feedback'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { updateProfileIdentity } from '../lib/data'
import { appUrl, isSupabaseConfigured, supabase } from '../lib/supabase'
import { useLocale } from '../i18n'

function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { t } = useLocale()
  return <div className="auth-page"><div className="auth-card"><Link className="auth-brand" to="/"><img className="auth-logo" src="/brand/logo-igda-peru.png" alt="" width="42" height="39" /><span className="brand-copy"><span className="brand-name">IGDA Peru</span><small>{t('nav.events')}</small></span></Link><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></div>
}

function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null
  return <p className={`form-message ${error ? 'error' : 'success'}`} role="alert">{error || success}</p>
}

function isSamePasswordError(error: { code?: string; message?: string } | null) {
  return error?.code === 'same_password' || /new password should be different from the old password/i.test(error?.message || '')
}

export function LoginPage() {
  const { t } = useLocale()
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
    if (!supabase) { setError(t('auth.notConfigured')); return }
    setLoading(true)
    const result = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else navigate(from, { replace: true })
  }

  return <AuthFrame title={t('auth.login')} description={t('auth.loginDescription')}>{!configured && <DemoNotice />}<form className="auth-form" onSubmit={submit}><label>{t('auth.email')}<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{t('auth.password')}<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><FormMessage error={error} /><button className="primary-button full" disabled={loading}>{loading ? t('auth.signingIn') : t('auth.login')}</button></form><div className="auth-links"><Link to="/registro">{t('auth.invitationQuestion')}</Link><Link to="/recuperar">{t('auth.forgotPassword')}</Link></div></AuthFrame>
}

export function RegisterPage() {
  const { t } = useLocale()
  return <AuthFrame title={t('auth.invitationTitle')} description={t('auth.invitationDescription')}>
    <div className="success-panel"><ShieldCheck size={31} /><p>{t('auth.invitationInstructions')}</p><p>{t('auth.confirmInvitation')}</p></div>
    <div className="auth-links"><Link to="/login">{t('auth.haveAccount')}</Link><Link to="/">{t('auth.backToEvents')}</Link></div>
  </AuthFrame>
}

export function ForgotPasswordPage() {
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('')
    if (!supabase) { setError(t('auth.notConfigured')); return }
    if (isSupabaseConfigured && !turnstileToken) { setError(t('auth.captchaRequired')); return }
    setLoading(true)
    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/restablecer`, captchaToken: turnstileToken || undefined })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else { setSuccess(t('auth.instructionsSent')); setTurnstileToken(''); setTurnstileResetSignal((value) => value + 1) }
  }
  return <AuthFrame title={t('auth.recoverTitle')} description={t('auth.recoverDescription')}><form className="auth-form" onSubmit={submit}><label>{t('auth.email')}<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><TurnstileWidget action="password-recovery" value={turnstileToken} onChange={setTurnstileToken} resetSignal={turnstileResetSignal} /><FormMessage error={error} success={success} /><button className="primary-button full" disabled={loading}>{loading ? t('auth.sending') : t('auth.sendInstructions')}</button></form><div className="auth-links"><Link to="/login"><ArrowLeft size={15} /> {t('auth.backToSignIn')}</Link></div></AuthFrame>
}

export function ResetPasswordPage() {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase) { setError(t('auth.notConfigured')); return }
    const result = await supabase.auth.updateUser({ password })
    if (result.error) setError(result.error.message)
    else setSuccess(true)
  }
  return <AuthFrame title={t('auth.newPasswordTitle')} description={t('auth.newPasswordDescription')}>{success ? <div className="success-panel"><CheckCircle2 size={31} /><p>{t('auth.passwordUpdated')}</p><button className="primary-button full" type="button" onClick={() => navigate('/app')}>{t('auth.goToDashboard')}</button></div> : <form className="auth-form" onSubmit={submit}><label>{t('auth.newPasswordTitle')}<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><FormMessage error={error} /><button className="primary-button full">{t('auth.savePassword')}</button></form>}</AuthFrame>
}

export function ChangePasswordPage() {
  const { t } = useLocale()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase) { setError(t('auth.notConfigured')); return }
    if (password.length < 8) { setError(t('auth.passwordTooShort')); return }
    if (password !== confirmation) { setError(t('auth.passwordsDoNotMatch')); return }
    setLoading(true)
    const result = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else setSuccess(true)
  }

  return <AuthFrame title={t('auth.changePasswordTitle')} description={t('auth.changePasswordDescription')}>{success ? <div className="success-panel"><CheckCircle2 size={31} /><p>{t('auth.passwordUpdated')}</p><button className="primary-button full" type="button" onClick={() => navigate('/app')}>{t('auth.backToDashboard')}</button></div> : <form className="auth-form" onSubmit={submit}><label>{t('auth.newPasswordTitle')}<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>{t('auth.confirmPassword')}<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><FormMessage error={error} /><button className="primary-button full" disabled={loading}>{loading ? t('auth.saving') : t('auth.savePassword')}</button></form>}<div className="auth-links"><Link to="/app"><ArrowLeft size={15} /> {t('auth.backToDashboard')}</Link></div></AuthFrame>
}

export function EditProfilePage() {
  const { t } = useLocale()
  const { user, profile, refreshUserData } = useAuth()
  const [firstName, setFirstName] = useState(() => profile?.firstName || profile?.displayName?.split(' ')[0] || '')
  const [lastName, setLastName] = useState(() => profile?.lastName || profile?.displayName?.split(' ').slice(1).join(' ') || '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess(false)
    if (!supabase || !user) { setError(t('auth.accountNotIdentified')); return }
    const normalizedFirstName = firstName.trim()
    const normalizedLastName = lastName.trim()
    if (normalizedFirstName.length < 2) { setError(t('auth.enterFirstNames')); return }
    setLoading(true)
    const displayName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(' ')
    const authUpdate = await supabase.auth.updateUser({ data: { first_name: normalizedFirstName, last_name: normalizedLastName, display_name: displayName } })
    if (authUpdate.error) { setLoading(false); setError(authUpdate.error.message); return }
    try {
      await updateProfileIdentity(user.id, normalizedFirstName, normalizedLastName)
      await refreshUserData()
      setSuccess(true)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t('auth.saveProfileError'))
    } finally {
      setLoading(false)
    }
  }

  return <AuthFrame title={t('auth.editProfile')} description={t('auth.editProfileDescription')}>{success ? <div className="success-panel"><CheckCircle2 size={31} /><p>{t('auth.profileUpdated')}</p><Link className="primary-button full" to="/app">{t('auth.backToDashboard')}</Link></div> : <form className="auth-form" onSubmit={submit}><div className="identity-form-grid"><label>{t('auth.firstNames')}<input type="text" required minLength={2} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>{t('auth.lastName')}<input type="text" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div><FormMessage error={error} /><button className="primary-button full" disabled={loading}>{loading ? t('auth.saving') : t('auth.saveChanges')}</button></form>}<div className="auth-links"><Link to="/app"><ArrowLeft size={15} /> {t('auth.backToDashboard')}</Link></div></AuthFrame>
}

export function AcceptInvitationPage() {
  const { t } = useLocale()
  const { token = '' } = useParams()
  const { user, configured, refreshUserData } = useAuth()
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase || !user) { setError(t('auth.invitationOpenLink')); return }
    if (isSupabaseConfigured && !turnstileToken) { setError(t('auth.invitationCaptchaRequired')); return }
    setLoading(true)
    const normalizedFirstName = firstName.trim()
    const normalizedLastName = lastName.trim()
    if (normalizedFirstName.length < 2) { setLoading(false); setError(t('auth.enterFirstNames')); return }
    const displayName = [normalizedFirstName, normalizedLastName].filter(Boolean).join(' ')
    const identity = { first_name: normalizedFirstName, last_name: normalizedLastName, display_name: displayName }
    const update = await supabase.auth.updateUser({ password, data: identity })
    if (update.error && !isSamePasswordError(update.error)) { setLoading(false); setError(update.error.message); return }
    if (update.error) {
      const identityUpdate = await supabase.auth.updateUser({ data: identity })
      if (identityUpdate.error) { setLoading(false); setError(identityUpdate.error.message); return }
    }
    try {
      await updateProfileIdentity(user.id, normalizedFirstName, normalizedLastName)
    } catch (reason: unknown) {
      setLoading(false)
      setError(reason instanceof Error ? reason.message : t('auth.saveIdentityError'))
      return
    }
    const result = await supabase.functions.invoke('accept-invitation', { body: { token, turnstileToken } })
    setLoading(false)
    if (result.error) setError(result.error.message)
    else { await refreshUserData(); setTurnstileToken(''); setTurnstileResetSignal((value) => value + 1); setSuccess(true) }
  }

  return <AuthFrame title={t('auth.acceptInvitation')} description={t('auth.acceptInvitationDescription')}>{!configured && <DemoNotice />}{!user ? <div className="invite-login"><ShieldCheck size={32} /><p>{t('auth.confirmEmailFirst')}</p><Link className="primary-button full" to={`/login?next=${encodeURIComponent(`/invitaciones/${token}`)}`}>{t('auth.login')}</Link></div> : success ? <div className="success-panel"><CheckCircle2 size={31} /><p>{t('auth.invitationAccepted')}</p><Link className="primary-button full" to="/app">{t('auth.goToDashboard')}</Link></div> : <form className="auth-form" onSubmit={submit}><div className="identity-form-grid"><label>{t('auth.firstNames')}<input type="text" required minLength={2} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>{t('auth.lastName')}<input type="text" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div><label>{t('auth.newOrCurrentPassword')}<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><TurnstileWidget action="accept-invitation" value={turnstileToken} onChange={setTurnstileToken} resetSignal={turnstileResetSignal} /><FormMessage error={error} /><button className="primary-button full" disabled={loading}>{loading ? t('auth.activating') : t('auth.acceptInvitation')}</button></form>}</AuthFrame>
}

export function AuthCallbackPage() {
  const { t } = useLocale()
  return <AuthFrame title={t('auth.accountConfirmed')} description={t('auth.accountConfirmedDescription')}><div className="success-panel"><Mail size={31} /><p>{t('auth.emailConfirmed')}</p><Link className="primary-button full" to="/app"><LockKeyhole size={17} /> {t('auth.goToDashboard')}</Link></div></AuthFrame>
}
