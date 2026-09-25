const displayFormatters = new Map<string, Intl.DateTimeFormat>()

function displayFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}:${JSON.stringify(options)}`
  let formatter = displayFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    displayFormatters.set(key, formatter)
  }
  return formatter
}

const limaDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const eventDateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function eventDateTimeTimestamp(value: string, timeZone: string) {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value).getTime()

  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value)
  if (!localMatch) return new Date(value).getTime()

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue = '0', fractionValue = '0'] = localMatch
  const localAsUtc = Date.UTC(Number(yearValue), Number(monthValue) - 1, Number(dayValue), Number(hourValue), Number(minuteValue), Number(secondValue))
  const milliseconds = Number(fractionValue.padEnd(3, '0'))
  try {
    let formatter = eventDateTimeFormatters.get(timeZone)
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      eventDateTimeFormatters.set(timeZone, formatter)
    }

    let timestamp = localAsUtc
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Map(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]))
      const representedAsUtc = Date.UTC(Number(parts.get('year')), Number(parts.get('month')) - 1, Number(parts.get('day')), Number(parts.get('hour')), Number(parts.get('minute')), Number(parts.get('second')))
      const adjustment = localAsUtc - representedAsUtc
      timestamp += adjustment
      if (adjustment === 0) break
    }
    return timestamp + milliseconds
  } catch {
    return new Date(value).getTime()
  }
}

export function formatDateParts(date: string | null | undefined, locale = 'es-PE') {
  if (!date) return { month: '—', date: '—', weekday: locale.startsWith('en') ? 'TBD' : locale.startsWith('qu') ? 'Mana sutichasqa' : 'Por definir' }
  const parsed = new Date(date)
  const month = displayFormatter(locale, { timeZone: 'America/Lima', month: 'short' }).format(parsed).replace('.', '').toUpperCase()
  const weekday = displayFormatter(locale, { timeZone: 'America/Lima', weekday: 'short' }).format(parsed).replace('.', '').toUpperCase()
  return { month, date: displayFormatter(locale, { timeZone: 'America/Lima', day: '2-digit' }).format(parsed), weekday }
}

export function formatDate(date: string | null | undefined, locale = 'es-PE') {
  if (!date) return locale.startsWith('en') ? 'Date to be confirmed' : locale.startsWith('qu') ? 'P’unchawta qhawarisunchik' : 'Fecha por definir'
  return displayFormatter(locale, { timeZone: 'America/Lima', weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(date)).replace('.', '')
}

export function formatEventDateRange(startsAt: string | null | undefined, endsAt: string | null | undefined, isAllDay = false, locale = 'es-PE') {
  if (!startsAt && !endsAt) return locale.startsWith('en') ? 'Date to be confirmed' : locale.startsWith('qu') ? 'P’unchawta qhawarisunchik' : 'Fecha por definir'
  const from = locale.startsWith('en') ? 'From' : locale.startsWith('qu') ? 'Qallariy' : 'Desde'
  if (!startsAt) return `${from} ${formatDate(endsAt, locale)}`
  if (!endsAt) return formatDate(startsAt, locale)

  const startDate = limaDateKeyFormatter.format(new Date(startsAt))
  const displayEnd = isAllDay ? new Date(new Date(endsAt).getTime() - 1) : new Date(endsAt)
  const endDate = limaDateKeyFormatter.format(displayEnd)
  return startDate === endDate ? formatDate(startsAt, locale) : `${formatDate(startsAt, locale)} – ${formatDate(displayEnd.toISOString(), locale)}`
}

export function formatTimeRange(startsAt: string | null | undefined, endsAt: string | null | undefined, isAllDay = false, locale = 'es-PE') {
  if (isAllDay && (startsAt || endsAt)) return locale.startsWith('en') ? 'All day' : locale.startsWith('qu') ? 'P’unchaw llapan' : 'Todo el día'
  if (!startsAt && !endsAt) return locale.startsWith('en') ? 'Time to be confirmed' : locale.startsWith('qu') ? 'Pachata qhawarisunchik' : 'Hora por definir'
  const from = locale.startsWith('en') ? 'From' : locale.startsWith('qu') ? 'Qallariy' : 'Desde'
  const timeFormatter = displayFormatter(locale, { timeZone: 'America/Lima', hour: 'numeric', minute: '2-digit' })
  if (!startsAt) return `${from} ${timeFormatter.format(new Date(endsAt as string))}`
  if (!endsAt) return `${from} ${timeFormatter.format(new Date(startsAt))}`
  return `${timeFormatter.format(new Date(startsAt))} – ${timeFormatter.format(new Date(endsAt))}`
}

export function formatEventSchedule(startsAt: string | null | undefined, endsAt: string | null | undefined, isAllDay = false, locale = 'es-PE') {
  const dateLabel = formatEventDateRange(startsAt, endsAt, isAllDay, locale)
  const timeLabel = formatTimeRange(startsAt, endsAt, isAllDay, locale)
  return dateLabel === formatDate(startsAt, locale) ? timeLabel : `${dateLabel} · ${timeLabel}`
}

export function formatEventLocation(event: { locationType: 'venue' | 'online' | 'hybrid'; accessMode?: 'registration_only' | 'location_access' | null; locationPrecision?: 'none' | 'department' | 'province' | 'exact' | null; locationDepartment?: string | null; locationProvince?: string | null; venueName?: string | null; address?: string | null; formattedAddress?: string | null }, locale = 'es-PE') {
  const privateLabel = locale.startsWith('en') ? 'Private location' : locale.startsWith('qu') ? 'Pakay maypi' : 'Ubicación privada'
  const onlineLabel = locale.startsWith('en') ? 'Online' : locale.startsWith('qu') ? 'Internetpi' : 'Online'
  const tbdLabel = locale.startsWith('en') ? 'Location to be confirmed' : locale.startsWith('qu') ? 'Maypi kananta qhawarisunchik' : 'Ubicación por confirmar'
  if (event.accessMode === 'registration_only') return privateLabel
  if (event.locationType === 'online') return onlineLabel

  const precision = event.locationPrecision || (event.venueName?.trim() || event.address?.trim() || event.formattedAddress?.trim() ? 'exact' : 'none')
  let location = ''
  if (precision === 'department' && event.locationDepartment?.trim()) location = `${event.locationDepartment.trim()}, Perú`
  if (precision === 'province' && event.locationProvince?.trim()) location = [event.locationProvince.trim(), event.locationDepartment?.trim()].filter(Boolean).join(', ')

  const placeName = event.venueName?.trim() || ''
  const address = event.formattedAddress?.trim() || event.address?.trim() || ''
  const locationParts = [placeName, address].filter((part, index, parts) => part && parts.indexOf(part) === index)
  if (!location && precision === 'exact') location = locationParts.join(' · ')
  if (!location) location = event.locationType === 'hybrid' || (event.accessMode === 'location_access' && precision === 'none') ? privateLabel : tbdLabel
  const hybridLabel = locale.startsWith('en') ? 'Hybrid' : locale.startsWith('qu') ? 'Iskay rikchay' : 'Híbrido'
  return event.locationType === 'hybrid' ? `${hybridLabel} · ${location}` : location
}

export function isEventPast(eventOrEndsAt: { endsAt: string | null } | string | null | undefined) {
  const endsAt = typeof eventOrEndsAt === 'string' ? eventOrEndsAt : eventOrEndsAt?.endsAt
  if (!endsAt) return false
  return new Date(endsAt).getTime() <= Date.now()
}

export function isEventOngoing(event: { startsAt: string | null; endsAt: string | null; timezone?: string; status?: string }, now = Date.now()) {
  if (!event.startsAt || !event.endsAt || (event.status && event.status !== 'published')) return false
  const startsAt = eventDateTimeTimestamp(event.startsAt, event.timezone || 'America/Lima')
  const endsAt = eventDateTimeTimestamp(event.endsAt, event.timezone || 'America/Lima')
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && now < endsAt
}

export function meetingActionLabel(provider?: string | null) {
  if (provider === 'google_meet') return 'Unirme por Google Meet'
  if (provider === 'zoom') return 'Unirme por Zoom'
  if (provider === 'discord') return 'Unirme por Discord'
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

export function eventSlug(title: string, communitySlug?: string) {
  return [slugify(title), slugify(communitySlug || '')].filter(Boolean).join('-')
}
