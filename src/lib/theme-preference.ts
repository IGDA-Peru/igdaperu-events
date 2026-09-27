export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const cookieName = 'igda_theme'
const storageName = 'igda-theme'
const validPreferences = new Set<ThemePreference>(['system', 'light', 'dark'])
const themeChangeEvent = 'igda-theme-preference-change'

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return Boolean(value && validPreferences.has(value as ThemePreference))
}

function readCookie(): ThemePreference | null {
  if (typeof document === 'undefined') return null
  const prefix = `${cookieName}=`
  const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix))
  const value = entry?.slice(prefix.length)
  return isThemePreference(value) ? value : null
}

function readLocalStorage(): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(storageName)
    return isThemePreference(value) ? value : null
  } catch {
    return null
  }
}

export function getThemePreference(): ThemePreference {
  return readCookie() || readLocalStorage() || 'system'
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, systemIsDark = systemPrefersDark()): ResolvedTheme {
  return preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference
}

export function applyThemePreference(preference = getThemePreference()): ResolvedTheme {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = preference
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = resolved === 'dark' ? '#101012' : '#fff4dc'
  return resolved
}

export function setThemePreference(preference: ThemePreference): void {
  if (!validPreferences.has(preference)) return

  try {
    window.localStorage.setItem(storageName, preference)
  } catch {
    // The selected theme remains active for this page when storage is unavailable.
  }

  const hostname = window.location.hostname
  if (hostname === 'igda.pe' || hostname.endsWith('.igda.pe')) {
    document.cookie = `${cookieName}=${preference}; Domain=igda.pe; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
  }

  applyThemePreference(preference)
  window.dispatchEvent(new CustomEvent<ThemePreference>(themeChangeEvent, { detail: preference }))
}

let initialized = false

export function initializeThemePreference(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  applyThemePreference()

  if (typeof window.matchMedia !== 'function') return
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
  const updateForSystem = () => {
    if (getThemePreference() === 'system') applyThemePreference('system')
  }
  if (typeof colorScheme.addEventListener === 'function') {
    colorScheme.addEventListener('change', updateForSystem)
  } else {
    colorScheme.addListener(updateForSystem)
  }
}

export function subscribeToThemePreference(listener: (preference: ThemePreference) => void): () => void {
  const handleChange = (event: Event) => {
    const preference = (event as CustomEvent<ThemePreference>).detail
    listener(isThemePreference(preference) ? preference : getThemePreference())
  }
  window.addEventListener(themeChangeEvent, handleChange)
  return () => window.removeEventListener(themeChangeEvent, handleChange)
}
