import type { EventInput } from '../types'

export type EventValidationMode = 'draft' | 'publish'
export type EventField = 'communityId' | 'title' | 'description' | 'startsAt' | 'endsAt' | 'location' | 'meetingUrl' | 'mapUrl'

export type EventValidationResult = {
  errors: Partial<Record<EventField, string>>
  missing: EventField[]
  valid: boolean
}

export const eventFieldLabels: Record<EventField, string> = {
  communityId: 'Comunidad',
  title: 'Título del evento',
  description: 'Descripción',
  startsAt: 'Fecha y hora de inicio',
  endsAt: 'Fecha y hora de fin',
  location: 'Ubicación',
  meetingUrl: 'Enlace para unirse',
  mapUrl: 'Enlace de Google Maps',
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateEvent(input: EventInput, mode: EventValidationMode): EventValidationResult {
  const errors: Partial<Record<EventField, string>> = {}
  const title = input.title.trim()
  const description = input.description.trim()
  const needsPhysicalLocation = input.locationType !== 'online'
  const needsMeetingLink = input.locationType !== 'venue'

  if (!input.communityId) errors.communityId = 'Selecciona la comunidad que organiza el evento.'
  if (!title) errors.title = 'Añade un título para identificar el evento.'
  else if (title.length < 3) errors.title = 'El título debe tener al menos 3 caracteres.'

  const minimalRequirements = mode === 'draft' || input.visibility === 'network'

  if (minimalRequirements) {
    if (!input.startsAt) errors.startsAt = 'Indica la fecha y hora de inicio.'
    if (!input.endsAt) errors.endsAt = 'Indica la fecha y hora de fin.'
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      errors.endsAt = !input.isAllDay && input.startsAt.slice(0, 10) === input.endsAt.slice(0, 10)
        ? 'La hora de fin debe ser posterior a la hora de inicio.'
        : 'La fecha de fin debe ser igual o posterior a la fecha de inicio.'
    }
  } else if (mode === 'publish') {
    if (!description) errors.description = 'Describe qué encontrarán las personas asistentes.'
    else if (description.length < 3) errors.description = 'La descripción debe tener al menos 3 caracteres.'
    if (!input.startsAt) errors.startsAt = 'Indica cuándo empieza el evento.'
    if (!input.endsAt) errors.endsAt = 'Indica cuándo termina el evento.'
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      errors.endsAt = !input.isAllDay && input.startsAt.slice(0, 10) === input.endsAt.slice(0, 10)
        ? 'La hora de fin debe ser posterior a la hora de inicio.'
        : 'La fecha de fin debe ser igual o posterior a la fecha de inicio.'
    }
    if (needsPhysicalLocation && !input.venueName.trim() && !input.address.trim() && (input.latitude == null || input.longitude == null)) errors.location = 'Añade un lugar, una dirección o selecciona un punto en el mapa.'
    if (needsMeetingLink && !input.meetingUrl.trim()) errors.meetingUrl = 'Añade un enlace de Google Meet, Zoom, Discord u otra plataforma.'
  }

  if (!minimalRequirements && input.meetingUrl.trim() && !isHttpUrl(input.meetingUrl)) errors.meetingUrl = 'El enlace debe comenzar con http:// o https://.'
  if (!minimalRequirements && input.mapUrl.trim() && !isHttpUrl(input.mapUrl)) errors.mapUrl = 'El enlace de Google Maps debe comenzar con http:// o https://.'

  const missing = Object.keys(errors).filter((field): field is EventField => field in eventFieldLabels)
  return { errors, missing, valid: missing.length === 0 }
}
