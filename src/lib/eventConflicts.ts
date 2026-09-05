export function eventIntervalsOverlap(firstStartsAt: string, firstEndsAt: string, secondStartsAt: string, secondEndsAt: string) {
  const firstStart = new Date(firstStartsAt).getTime()
  const firstEnd = new Date(firstEndsAt).getTime()
  const secondStart = new Date(secondStartsAt).getTime()
  const secondEnd = new Date(secondEndsAt).getTime()

  if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)) return false
  return secondStart < firstEnd && secondEnd > firstStart
}
