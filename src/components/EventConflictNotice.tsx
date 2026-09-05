import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'
import { formatEventDateRange, formatTimeRange } from '../lib/format'
import type { EventConflict } from '../types'

export type EventConflictStatus = 'idle' | 'loading' | 'ready' | 'error'

export function EventConflictNotice({ status, conflicts, hasMore, error }: { status: EventConflictStatus; conflicts: EventConflict[]; hasMore: boolean; error?: string }) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return <div className="event-conflict-notice checking" role="status" aria-live="polite"><Clock3 size={18} aria-hidden="true" /><span>Revisando si hay cruces con eventos de toda la red…</span></div>
  }

  if (status === 'error') {
    return <div className="event-conflict-notice warning" role="status" aria-live="polite"><AlertTriangle size={18} aria-hidden="true" /><span><strong>No pudimos revisar los cruces</strong><small>{error || 'El servicio no está disponible en este momento.'}</small><small>Puedes continuar y revisar la agenda más tarde.</small></span></div>
  }

  if (!conflicts.length) {
    return <div className="event-conflict-notice clear" role="status" aria-live="polite"><CheckCircle2 size={18} aria-hidden="true" /><span>No encontramos eventos cruzados en la agenda de la red.</span></div>
  }

  return <div className="event-conflict-notice warning" role="status" aria-live="polite">
    <AlertTriangle size={18} aria-hidden="true" />
    <div>
      <strong>Hay {conflicts.length === 1 ? 'un evento' : `${conflicts.length} eventos`} en el mismo horario</strong>
      <ul>
        {conflicts.map((conflict) => <li key={conflict.id}><strong>{conflict.title}</strong><small>{conflict.communityName} · {formatEventDateRange(conflict.startsAt, conflict.endsAt, conflict.isAllDay)} · {formatTimeRange(conflict.startsAt, conflict.endsAt, conflict.isAllDay)}</small></li>)}
      </ul>
      <small>Puedes continuar si el cruce es intencional.{hasMore ? ' Hay más eventos coincidentes.' : ''}</small>
    </div>
  </div>
}
