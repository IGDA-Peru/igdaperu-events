import type { EventItem } from '../types'
import { peruLocations } from './peruLocations'

export const timeFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'next-month', label: 'Próximo mes' },
  { value: 'year', label: 'Este año' },
] as const

export type TimeFilter = typeof timeFilters[number]['value']
export type CommunityFilterOption = { value: string; label: string }
export const modalityFilters = [
  { value: 'all', label: 'Todas' },
  { value: 'venue', label: 'Presencial' },
  { value: 'online', label: 'On-line' },
  { value: 'hybrid', label: 'Híbrido' },
] as const
export type ModalityFilter = typeof modalityFilters[number]['value']

export const peruDepartmentNames = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
  'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto',
  'Madre de Dios', 'Moquegua', 'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
] as const

export const locationFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'Perú', label: 'Perú' },
  { value: 'Internacional', label: 'Internacional' },
] as const

export const departmentFilters = peruDepartmentNames.map((department) => ({ value: department, label: department }))

const postalCodeDepartments: Record<string, typeof peruDepartmentNames[number]> = {
  '01': 'Amazonas', '02': 'Áncash', '03': 'Apurímac', '04': 'Arequipa', '05': 'Ayacucho', '06': 'Cajamarca',
  '07': 'Callao', '08': 'Cusco', '09': 'Huancavelica', '10': 'Huánuco', '11': 'Ica', '12': 'Junín',
  '13': 'La Libertad', '14': 'Lambayeque', '15': 'Lima', '16': 'Loreto', '17': 'Madre de Dios',
  '18': 'Moquegua', '19': 'Pasco', '20': 'Piura', '21': 'Puno', '22': 'San Martín', '23': 'Tacna',
  '24': 'Tumbes', '25': 'Ucayali',
}

const locationAliases: Array<{ department: typeof peruDepartmentNames[number]; aliases: string[] }> = [
  { department: 'Lima', aliases: ['Ancón', 'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas', 'El Agustino', 'Independencia', 'Jesús María', 'La Molina', 'La Victoria', 'Lince', 'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar', 'Miraflores', 'Pachacámac', 'Pucusana', 'Pueblo Libre', 'Puente Piedra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro', 'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis', 'San Martín de Porres', 'San Miguel', 'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco', 'Surquillo', 'Villa El Salvador', 'Villa María del Triunfo'] },
  { department: 'Callao', aliases: ['Bellavista', 'Carmen de la Legua Reynoso', 'La Perla', 'La Punta', 'Mi Perú', 'Ventanilla'] },
]

function normalizeLocation(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function normalizedLocationText(value: string) {
  return normalizeLocation(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function decodeLocationText(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function eventLocationValues(event: EventItem) {
  return [event.locationDepartment, event.locationProvince, event.venueName, event.formattedAddress, event.address, event.mapUrl]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => [value, decodeLocationText(value)])
}

function locationContains(values: string[], term: string) {
  const normalizedTerm = normalizedLocationText(term)
  if (!normalizedTerm) return false
  return values.some((value) => ` ${normalizedLocationText(value)} `.includes(` ${normalizedTerm} `))
}

function departmentFromPostalCode(values: string[]) {
  const postalCode = values.join(' ').match(/(?:^|\D)(\d{2})\d{3}(?:\D|$)/)?.[1]
  return postalCode ? postalCodeDepartments[postalCode] : undefined
}

function departmentFromAliases(segments: string[]) {
  for (const segment of [...segments].reverse()) {
    const match = locationAliases.find(({ aliases }) => aliases.some((alias) => locationContains([segment], alias)))
    if (match) return match.department
  }
  return undefined
}

function locationSegments(values: string[]) {
  return values.flatMap((value) => value.split(/[,;|\n·]+/).map((part) => part.trim()).filter(Boolean))
}

function departmentFromSegments(segments: string[]) {
  for (const segment of [...segments].reverse()) {
    const department = peruDepartmentNames.find((candidate) => locationContains([segment], candidate))
    if (department) return department
    const provinceDepartment = peruDepartmentNames.find((candidate) => {
      const provinces = peruLocations[candidate as keyof typeof peruLocations] || []
      return provinces.some((province) => locationContains([segment], province))
    })
    if (provinceDepartment) return provinceDepartment
  }
  return undefined
}

function departmentForLocation(event: EventItem, values: string[]) {
  const explicitDepartment = event.locationDepartment?.trim() ? [event.locationDepartment] : []
  const explicitProvince = event.locationProvince?.trim() ? [event.locationProvince] : []
  const department = departmentFromSegments(explicitDepartment)
  if (department) return department
  const provinceDepartment = departmentFromSegments(explicitProvince)
  if (provinceDepartment) return provinceDepartment

  const addressValues = [event.formattedAddress, event.address, event.mapUrl]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => [value, decodeLocationText(value)])
  const postalCodeDepartment = departmentFromPostalCode(addressValues)
  if (postalCodeDepartment) return postalCodeDepartment
  const addressDepartment = departmentFromSegments(locationSegments(addressValues))
  if (addressDepartment) return addressDepartment

  const addressAliasDepartment = departmentFromAliases(locationSegments(addressValues))
  if (addressAliasDepartment) return addressAliasDepartment

  const locationParts = locationSegments(values)
  return departmentFromSegments(locationParts) || departmentFromAliases(locationParts)
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

export function matchesModalityFilter(event: EventItem, filter: ModalityFilter = 'all') {
  return filter === 'all' || event.locationType === filter
}

export function matchesLocationFilter(event: EventItem, filter: string) {
  if (filter === 'all') return true
  const locationValues = eventLocationValues(event)
  const department = departmentForLocation(event, locationValues)
  const isPeruLocation = locationContains(locationValues, 'Perú') || Boolean(department)
  if (filter === 'Perú') return isPeruLocation
  if (filter === 'Internacional') return locationValues.length > 0 && !isPeruLocation
  if (peruDepartmentNames.includes(filter as typeof peruDepartmentNames[number])) return isPeruLocation && department === filter
  return locationContains(locationValues, filter)
}

export function matchesCommunityFilter(event: EventItem, filter = 'all') {
  if (filter === 'all') return true
  if (filter === '__independent__') return !event.communityId
  return event.communityId === filter
}

export function filterEvents(events: EventItem[], options: { search: string; timeFilter: TimeFilter; modalityFilter?: ModalityFilter; locationFilter: string; communityFilter?: string }) {
  const query = options.search.trim().toLowerCase()
  return events.filter((event) => {
    const matchesSearch = !query || `${event.title} ${event.description} ${event.communityName}`.toLowerCase().includes(query)
    return matchesSearch && matchesTimeFilter(event, options.timeFilter) && matchesModalityFilter(event, options.modalityFilter) && matchesLocationFilter(event, options.locationFilter) && matchesCommunityFilter(event, options.communityFilter)
  })
}
