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

export function formatDateParts(date: string) {
  const parsed = new Date(date)
  const month = monthFormatter.format(parsed).replace('.', '').toUpperCase()
  const weekday = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short' }).format(parsed).replace('.', '').toUpperCase()
  return { month, date: new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit' }).format(parsed), weekday }
}

export function formatDate(date: string) {
  return limaFormatter.format(new Date(date)).replace('.', '')
}

export function formatTimeRange(startsAt: string, endsAt: string) {
  return `${timeFormatter.format(new Date(startsAt))} – ${timeFormatter.format(new Date(endsAt))}`
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
