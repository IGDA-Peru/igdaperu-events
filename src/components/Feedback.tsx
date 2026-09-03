import { AlertCircle, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Cargando agenda' }: { label?: string }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={26} aria-hidden="true" /><span>{label}</span></div>
}

export function ErrorState({ message = 'No pudimos cargar esta información.' }: { message?: string }) {
  return <div className="error-state"><AlertCircle size={25} aria-hidden="true" /><span>{message}</span></div>
}

export function DemoNotice() {
  return <div className="demo-notice">Vista de demostración. Conecta Supabase para trabajar con datos reales.</div>
}
