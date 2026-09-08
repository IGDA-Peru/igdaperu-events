export const standardEventTypes = ['CHARLA', 'TALLER', 'MEETUP', 'GAME JAM', 'CONFERENCIA'] as const

export const eventTypeOptions = [...standardEventTypes, 'OTRO'] as const

export function isStandardEventType(value: string) {
  return (standardEventTypes as readonly string[]).includes(value)
}
