import { AlertCircle, LoaderCircle } from 'lucide-react'
import { useLocale } from '../i18n'

const loadingMessageKeys: Record<string, string> = {
  'Cargando eventos': 'feedback.loadingEvents',
  'Cargando tus eventos': 'feedback.loadingYourEvents',
  'Cargando eventos de la comunidad': 'feedback.loadingCommunityEvents',
  'Cargando editor': 'feedback.loadingEditor',
  'Cargando comunidad': 'feedback.loadingCommunity',
  'Cargando miembros': 'feedback.loadingMembers',
  'Cargando comunidades': 'feedback.loadingCommunities',
  'Cargando propuestas': 'feedback.loadingProposals',
  'Verificando sesión': 'feedback.checkingSession',
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useLocale()
  const message = label ? t(loadingMessageKeys[label] || '') || label : t('feedback.loadingEvents')
  return <div className="loading-state"><LoaderCircle className="spin" size={26} aria-hidden="true" /><span>{message}</span></div>
}

export function ErrorState({ message }: { message?: string }) {
  const { t } = useLocale()
  const errorMessage = message ?? t('feedback.loadError')
  return <div className="error-state"><AlertCircle size={25} aria-hidden="true" /><span>{errorMessage}</span></div>
}

export function DemoNotice() {
  const { t } = useLocale()
  return <div className="demo-notice">{t('feedback.demoNotice')}</div>
}
