import { useEffect, useRef } from 'react'

type TurnstileInstance = {
  render: (element: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance
  }
}

let turnstileScriptPromise: Promise<void> | null = null

const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise
  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Turnstile.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstileScript = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile.'))
    document.head.appendChild(script)
  })
  return turnstileScriptPromise
}

export function TurnstileWidget({ value, onChange, resetSignal = 0, action = 'form' }: { value: string; onChange: (token: string) => void; resetSignal?: number; action?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const onChangeRef = useRef(onChange)
  const siteKey = turnstileSiteKey

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let active = true
    void loadTurnstileScript().then(() => {
      if (!active || !containerRef.current || !window.turnstile) return
      containerRef.current.replaceChildren()
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: (token) => onChangeRef.current(token),
        'expired-callback': () => onChangeRef.current(''),
        'error-callback': () => onChangeRef.current(''),
      })
    }).catch(() => onChangeRef.current(''))
    return () => { active = false }
  }, [action, siteKey])

  useEffect(() => {
    if (!siteKey || resetSignal === 0 || !widgetIdRef.current || !window.turnstile) return
    window.turnstile.reset(widgetIdRef.current)
    onChangeRef.current('')
  }, [resetSignal, siteKey])

  if (!siteKey) return <div className="turnstile-placeholder" role="status">La protección antispam se activará al configurar Turnstile.</div>
  return <div className="turnstile-field"><div ref={containerRef} /><input type="hidden" aria-label="Verificación antispam" value={value} readOnly /></div>
}
