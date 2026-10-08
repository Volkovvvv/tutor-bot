const WEEK_MS = 7 * 24 * 60 * 60_000

/** На сколько недель вперёд у серии созданы занятия. */
export const SERIES_HORIZON_WEEKS = 12

/** Смещение таймзоны от UTC в миллисекундах в момент at; незнакомая зона — 0. */
function zoneOffset(at: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return wall - Math.floor(at.getTime() / 1000) * 1000
  } catch {
    return 0
  }
}

/**
 * Тот же день недели и то же время на часах репетитора через weeks недель.
 *
 * Просто прибавить 7 суток нельзя: там, где переводят часы, занятие
 * «по средам в 16:00» после перевода уехало бы на 15:00 или 17:00.
 */
export function weeksLater(first: Date, weeks: number, timezone: string): Date {
  const naive = new Date(first.getTime() + weeks * WEEK_MS)
  return new Date(naive.getTime() + zoneOffset(first, timezone) - zoneOffset(naive, timezone))
}

/**
 * Начала занятий серии позже after и не позже until.
 *
 * after = null — с самого первого занятия. endsAt — серия остановлена:
 * с этого момента занятий нет.
 */
export function seriesOccurrences(
  first: Date,
  after: Date | null,
  until: Date,
  timezone: string,
  endsAt: Date | null = null,
): Date[] {
  const result: Date[] = []
  // У давней серии не перебираем все прошедшие недели; запас в неделю — на перевод часов
  const from = after ? Math.max(0, Math.floor((after.getTime() - first.getTime()) / WEEK_MS) - 1) : 0
  for (let week = from; ; week++) {
    const at = weeksLater(first, week, timezone)
    if (at > until) break
    if (endsAt && at >= endsAt) break
    if (!after || at > after) result.push(at)
  }
  return result
}

/** Один и тот же недельный слот: моменты отличаются на целое число недель. */
export function sameWeeklySlot(a: Date, b: Date, timezone: string): boolean {
  const wall = (d: Date) => d.getTime() + zoneOffset(d, timezone)
  return (((wall(a) - wall(b)) % WEEK_MS) + WEEK_MS) % WEEK_MS === 0
}

export function horizonFrom(now: Date): Date {
  return new Date(now.getTime() + SERIES_HORIZON_WEEKS * WEEK_MS)
}
