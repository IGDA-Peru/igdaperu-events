import type { EventInput } from '../types'
import { EVENT_DESCRIPTION_MAX_LENGTH } from './eventLimits'

export type EventValidationMode = 'draft' | 'publish'
export type EventField = 'communityId' | 'organizerName' | 'title' | 'type' | 'description' | 'startsAt' | 'endsAt' | 'location' | 'meetingUrl' | 'registrationUrl' | 'mapUrl'

export type EventValidationResult = {
  errors: Partial<Record<EventField, string>>
  missing: EventField[]
  valid: boolean
}

export const eventFieldLabels: Record<EventField, string> = {
  communityId: 'Comunidad',
  organizerName: 'Organizador',
  title: 'Título del evento',
  type: 'Tipo de evento',
  description: 'Descripción',
  startsAt: 'Fecha y hora de inicio',
  endsAt: 'Fecha y hora de fin',
  location: 'Ubicación',
  meetingUrl: 'Enlace para unirse',
  registrationUrl: 'Enlace de inscripción',
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

export function validateEvent(input: EventInput, mode: EventValidationMode, options: { allowIndependent?: boolean } = {}): EventValidationResult {
  const errors: Partial<Record<EventField, string>> = {}
  const title = input.title.trim()
  const description = input.description.trim()

  if (description.length > EVENT_DESCRIPTION_MAX_LENGTH) errors.description = `La descripción no puede superar ${EVENT_DESCRIPTION_MAX_LENGTH} caracteres.`

  if (!input.communityId && !options.allowIndependent) errors.communityId = 'Selecciona la comunidad que organiza el evento.'
  if (!input.communityId && options.allowIndependent && !input.organizerName?.trim()) errors.organizerName = 'Indica quién organiza el evento independiente.'
  if (!title) errors.title = 'Añade un título para identificar el evento.'
  else if (title.length < 3) errors.title = 'El título debe tener al menos 3 caracteres.'
  const eventType = input.type.trim()
  if (!eventType || eventType.toUpperCase() === 'OTRO') errors.type = 'Especifica el tipo de evento.'
  else if (eventType.length > 40) errors.type = 'El tipo de evento no puede superar 40 caracteres.'

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
    if (input.accessMode === 'location_access' && input.locationType !== 'venue' && !input.meetingUrl.trim()) errors.meetingUrl = 'Añade el enlace para unirse al evento online o híbrido.'
    if (input.accessMode === 'location_access' && input.locationType !== 'online') {
      if (input.locationPrecision === 'department' && !input.locationDepartment.trim()) errors.location = 'Selecciona el departamento que quieres compartir.'
      if (input.locationPrecision === 'province' && (!input.locationDepartment.trim() || !input.locationProvince.trim())) errors.location = 'Selecciona el departamento y la provincia que quieres compartir.'
      if (input.locationPrecision === 'exact' && !input.venueName.trim() && !input.address.trim() && (input.latitude == null || input.longitude == null)) errors.location = 'Añade un lugar, una dirección o selecciona un punto en el mapa.'
    }
  }

  if (!minimalRequirements && input.accessMode === 'location_access' && input.meetingUrl.trim() && !isHttpUrl(input.meetingUrl)) errors.meetingUrl = 'El enlace debe comenzar con http:// o https://.'
  if (!minimalRequirements && input.registrationUrl.trim() && !isHttpUrl(input.registrationUrl)) errors.registrationUrl = 'El enlace debe comenzar con http:// o https://.'
  if (!minimalRequirements && input.accessMode === 'location_access' && input.mapUrl.trim() && !isHttpUrl(input.mapUrl)) errors.mapUrl = 'El enlace de Google Maps debe comenzar con http:// o https://.'

  const missing = Object.keys(errors).filter((field): field is EventField => field in eventFieldLabels)
  return { errors, missing, valid: missing.length === 0 }
}
