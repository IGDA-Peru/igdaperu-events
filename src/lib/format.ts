const limaFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const monthFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  month: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateParts(date: string | null | undefined) {
  if (!date) return { month: '—', date: '—', weekday: 'Por definir' }
  const parsed = new Date(date)
  const month = monthFormatter.format(parsed).replace('.', '').toUpperCase()
  const weekday = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short' }).format(parsed).replace('.', '').toUpperCase()
  return { month, date: new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit' }).format(parsed), weekday }
}

export function formatDate(date: string | null | undefined) {
  if (!date) return 'Fecha por definir'
  return limaFormatter.format(new Date(date)).replace('.', '')
}

export function formatTimeRange(startsAt: string | null | undefined, endsAt: string | null | undefined) {
  if (!startsAt && !endsAt) return 'Hora por definir'
  if (!startsAt) return `Desde ${timeFormatter.format(new Date(endsAt as string))}`
  if (!endsAt) return `Desde ${timeFormatter.format(new Date(startsAt))}`
  return `${timeFormatter.format(new Date(startsAt))} – ${timeFormatter.format(new Date(endsAt))}`
}

export function formatEventLocation(event: { locationType: 'venue' | 'online' | 'hybrid'; venueName?: string | null; address?: string | null; formattedAddress?: string | null }) {
  if (event.locationType === 'online') return 'Online'

  const placeName = event.venueName?.trim() || ''
  const address = event.formattedAddress?.trim() || event.address?.trim() || ''
  const locationParts = [placeName, address].filter((part, index, parts) => part && parts.indexOf(part) === index)
  if (!locationParts.length) return event.locationType === 'hybrid' ? 'Híbrido' : 'Por confirmar'
  return event.locationType === 'hybrid' ? `Híbrido · ${locationParts.join(' · ')}` : locationParts.join(' · ')
}

export function isEventPast(eventOrEndsAt: { endsAt: string | null } | string | null | undefined) {
  const endsAt = typeof eventOrEndsAt === 'string' ? eventOrEndsAt : eventOrEndsAt?.endsAt
  if (!endsAt) return false
  return new Date(endsAt).getTime() <= Date.now()
}

export function meetingActionLabel(provider?: string | null) {
  if (provider === 'google_meet') return 'Unirme por Google Meet'
  if (provider === 'zoom') return 'Unirme por Zoom'
  return 'Abrir enlace para unirse'
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
