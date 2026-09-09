import { getCommunityLogoUrl } from '../lib/data'
import { normalizeCommunityColor } from '../lib/communityBranding'
import type { CSSProperties } from 'react'

export function CommunityLogo({ path, name, color, size = 'medium', decorative = false }: { path?: string | null; name: string; color?: string | null; size?: 'small' | 'medium' | 'large'; decorative?: boolean }) {
  const logoUrl = getCommunityLogoUrl(path)
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
  return <span className={`community-logo community-logo-${size}`} style={{ '--community-color': normalizeCommunityColor(color) } as CSSProperties}>
    {logoUrl ? <img src={logoUrl} alt={decorative ? '' : `Logo de ${name}`} /> : <span aria-hidden={decorative}>{initials}</span>}
  </span>
}
