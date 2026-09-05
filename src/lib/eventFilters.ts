import type { EventItem } from '../types'

export const timeFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'next-month', label: 'Próximo mes' },
  { value: 'year', label: 'Este año' },
] as const

export type TimeFilter = typeof timeFilters[number]['value']

export const peruDepartmentNames = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
  'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto',
  'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
] as const

export const locationFilters = ['Todos', 'Internacional'] as const

function normalizeLocation(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function limaDateKey(value: string | Date | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function matchesTimeFilter(event: EventItem, filter: TimeFilter) {
  if (filter === 'all') return true
  if (!event.startsAt) return false
  const todayKey = limaDateKey(new Date())
  const eventKey = limaDateKey(event.startsAt)
  if (filter === 'today') return eventKey === todayKey

  const todayStart = new Date(`${todayKey}T00:00:00-05:00`)
  const eventDate = new Date(event.startsAt)
  if (filter === 'week') {
    const weekEnd = new Date(todayStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
    return eventDate >= todayStart && eventDate < weekEnd
  }

  const currentMonthKey = todayKey.slice(0, 7)
  if (filter === 'month') return eventKey.startsWith(currentMonthKey)
  if (filter === 'year') return eventKey.startsWith(todayKey.slice(0, 4))

  const nextMonth = new Date(todayStart)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
  return eventKey.startsWith(limaDateKey(nextMonth).slice(0, 7))
}

export function matchesLocationFilter(event: EventItem, filter: string) {
  if (filter === 'all') return true
  const location = normalizeLocation(`${event.venueName || ''} ${event.formattedAddress || ''} ${event.address || ''}`)
  if (filter === 'Internacional') return Boolean(location) && !peruDepartmentNames.some((department) => location.includes(normalizeLocation(department)))
  return location.includes(normalizeLocation(filter))
}

export function filterEvents(events: EventItem[], options: { search: string; timeFilter: TimeFilter; locationFilter: string }) {
  const query = options.search.trim().toLowerCase()
  return events.filter((event) => {
    const matchesSearch = !query || `${event.title} ${event.description} ${event.communityName}`.toLowerCase().includes(query)
    return matchesSearch && matchesTimeFilter(event, options.timeFilter) && matchesLocationFilter(event, options.locationFilter)
  })
}
