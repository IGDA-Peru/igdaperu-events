import { Check, ImagePlus, Palette, X } from 'lucide-react'
import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getCommunityLogoUrl, updateCommunityBranding, uploadCommunityLogo } from '../lib/data'
import { COMMUNITY_COLOR_PRESETS, DEFAULT_COMMUNITY_COLOR, normalizeCommunityColor } from '../lib/communityBranding'
import type { Membership } from '../types'

const SETUP_SEEN_PREFIX = 'igdaperu:community-setup-seen:'

function setupSeenKey(userId: string, communityId: string) {
  return `${SETUP_SEEN_PREFIX}${userId}:${communityId}`
}

function hasSeenSetup(userId: string, communityId: string) {
  try {
    return window.localStorage.getItem(setupSeenKey(userId, communityId)) === '1'
  } catch {
    return false
  }
}

function markSetupSeen(userId: string, communityId: string) {
  try {
    window.localStorage.setItem(setupSeenKey(userId, communityId), '1')
  } catch {
    // Private browsing or a blocked storage area should not prevent the user from continuing.
  }
}

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer la imagen.')) }
    image.src = url
  })
}

function needsSetup(membership: Membership) {
  return membership.role === 'community_admin' && (!membership.communityLogoPath || !membership.communityColor)
}

export function CommunitySetupPrompt() {
  const { user, memberships, refreshUserData } = useAuth()
  const [candidate, setCandidate] = useState<Membership | null>(null)
  const [open, setOpen] = useState(false)
  const [brandColor, setBrandColor] = useState(DEFAULT_COMMUNITY_COLOR)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setCandidate(null)
      setOpen(false)
      return
    }
    const next = memberships.find((membership) => needsSetup(membership) && !hasSeenSetup(user.id, membership.communityId)) || null
    setCandidate(next)
    setBrandColor(normalizeCommunityColor(next?.communityColor))
    setOpen(Boolean(next))
    setError('')
  }, [memberships, user])

  useEffect(() => () => {
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
  }, [logoPreview])

  if (!open || !candidate || !user) return null

  const dismiss = () => {
    markSetupSeen(user.id, candidate.communityId)
    setOpen(false)
  }

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('El logo debe estar en formato JPG, PNG o WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('El logo no puede superar los 5 MB.'); return }
    try {
      const dimensions = await readImageSize(file)
      if (dimensions.width !== dimensions.height) { setError('El logo debe ser cuadrado, con proporción 1:1.'); return }
      if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos leer la imagen.')
    }
  }

  const save = async () => {
    setError('')
    if (!candidate.communityLogoPath && !logoFile) { setError('Selecciona un logo para continuar.'); return }
    setSaving(true)
    try {
      if (logoFile) await uploadCommunityLogo(candidate.communityId, logoFile, candidate.communityLogoPath)
      await updateCommunityBranding(candidate.communityId, normalizeCommunityColor(brandColor))
      markSetupSeen(user.id, candidate.communityId)
      await refreshUserData()
      setOpen(false)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No pudimos guardar la identidad de la comunidad.')
    } finally {
      setSaving(false)
    }
  }

  const logoPath = logoPreview || candidate.communityLogoPath
  return <div className="modal-layer community-setup-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss() }}>
    <section className="community-setup-modal" role="dialog" aria-modal="true" aria-labelledby="community-setup-title" aria-describedby="community-setup-description" onMouseDown={(event) => event.stopPropagation()}>
      <div className="community-setup-heading"><div><span className="dashboard-kicker">Primeros pasos</span><h2 id="community-setup-title">Configura {candidate.communityName}</h2></div><button className="icon-button" type="button" onClick={dismiss} aria-label="Cerrar"><X size={18} /></button></div>
      <p className="muted-copy" id="community-setup-description">Añade el logo y el color que identificarán a tu comunidad en los eventos. Puedes hacerlo ahora o ir después a <strong>Panel → Gestionar comunidad → Información pública</strong>.</p>
      <div className="community-setup-brand-preview"><span className="community-setup-logo"><img src={getCommunityLogoUrl(logoPath) || '/brand/logo-igda-peru.png'} alt="" /></span><span><strong>{candidate.communityName}</strong><small style={{ color: brandColor }}>Así se verá tu identidad</small></span></div>
      <label className="community-setup-field"><span>Logo de la comunidad</span><span className="community-setup-file"><ImagePlus size={17} aria-hidden="true" />{logoFile ? logoFile.name : candidate.communityLogoPath ? 'Cambiar logo' : 'Seleccionar logo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleLogoChange(event)} /></span><small>Imagen cuadrada en JPG, PNG o WebP · máximo 5 MB.</small></label>
      <div className="community-setup-field"><span>Color de la comunidad</span><div className="community-setup-color-row"><label className="community-color-picker"><span className="sr-only">Elegir color</span><input type="color" aria-label="Color de la comunidad" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} /></label><div className="community-color-swatches" aria-label="Colores sugeridos">{COMMUNITY_COLOR_PRESETS.map((color) => <button className={brandColor === color ? 'selected' : ''} type="button" key={color} aria-label={`Usar color ${color}`} title={color} style={{ backgroundColor: color }} onClick={() => setBrandColor(color)} />)}</div><span className="community-setup-hex"><Palette size={15} aria-hidden="true" />{brandColor}</span></div></div>
      {error && <p className="form-message error" role="alert">{error}</p>}
      <div className="community-setup-actions"><Link className="secondary-button" to="/app/comunidad" onClick={dismiss}>Ir a configuración</Link><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}><Check size={16} />{saving ? 'Guardando…' : 'Guardar identidad'}</button></div>
    </section>
  </div>
}
