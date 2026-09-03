import { CalendarDays, LayoutList, List } from 'lucide-react'

export const eventViewModes = [
  { value: 'cards', label: 'Tarjetas', Icon: LayoutList },
  { value: 'calendar', label: 'Calendario', Icon: CalendarDays },
  { value: 'timeline', label: 'Línea de tiempo', Icon: List },
] as const

export type EventViewMode = typeof eventViewModes[number]['value']
