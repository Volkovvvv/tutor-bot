import { ReminderKind } from '@prisma/client'

/** Во сколько должно уйти конкретное напоминание. */
export interface PlannedReminder {
  kind: ReminderKind
  scheduledAt: Date
}

/** Настройки, влияющие на расписание напоминаний. */
export interface NotifyWindow {
  enabled: boolean
  beforeHours: number
  beforeMinutes: number
  /** Тихие часы «22:00»–«09:00» в таймзоне репетитора; не заданы — тишины нет. */
  quietFrom?: string | null
  quietTo?: string | null
}

const DAY_MINUTES = 1440
/** Напоминание, сдвинутое на конец тихих часов, должно прийти хотя бы за столько до занятия. */
const MIN_LEAD_MS = 30 * 60_000

function parseClock(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!m) return null
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return minutes < DAY_MINUTES && Number(m[2]) < 60 ? minutes : null
}

function minutesOfDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).formatToParts(date)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return part('hour') * 60 + part('minute')
}

/**
 * Выносит момент отправки из тихих часов.
 *
 * Сначала пробуем позже — на конец тишины: «за сутки» про занятие в 8:00
 * придёт в 9:00 накануне. Если так до занятия остаётся меньше получаса,
 * шлём раньше — за минуту до начала тишины: «за час» про то же занятие
 * придёт вечером накануне, а не в 7 утра.
 */
export function outOfQuiet(at: Date, startsAt: Date, notify: NotifyWindow, timezone: string): Date {
  const from = parseClock(notify.quietFrom)
  const to = parseClock(notify.quietTo)
  if (from === null || to === null || from === to) return at

  const sinceStart = (minutesOfDay(at, timezone) - from + DAY_MINUTES) % DAY_MINUTES
  const length = (to - from + DAY_MINUTES) % DAY_MINUTES
  if (sinceStart >= length) return at

  const later = new Date(at.getTime() + (length - sinceStart) * 60_000)
  if (startsAt.getTime() - later.getTime() >= MIN_LEAD_MS) return later
  return new Date(at.getTime() - (sinceStart + 1) * 60_000)
}

/**
 * Считает, когда нужно напомнить о занятии.
 *
 * Чистая функция без обращений к базе и без Date.now() внутри: время
 * передаётся аргументом, поэтому поведение полностью проверяемо тестами.
 */
export function planReminders(
  startsAt: Date,
  notify: NotifyWindow,
  now: Date,
  timezone = 'Europe/Moscow',
): PlannedReminder[] {
  if (!notify.enabled) return []

  const planned: PlannedReminder[] = []

  const add = (kind: ReminderKind, offsetMs: number): void => {
    if (offsetMs <= 0) return
    const scheduledAt = outOfQuiet(new Date(startsAt.getTime() - offsetMs), startsAt, notify, timezone)
    // Момент отправки уже прошёл — напоминание бессмысленно.
    // Иначе создание занятия «на завтра» с напоминанием за неделю
    // мгновенно отправляло бы просроченное уведомление.
    if (scheduledAt <= now) return
    // Тихие часы могли свести оба напоминания в одну минуту — двух подряд не шлём
    if (planned.some((p) => p.scheduledAt.getTime() === scheduledAt.getTime())) return
    planned.push({ kind, scheduledAt })
  }

  add(ReminderKind.BEFORE_HOURS, notify.beforeHours * 3_600_000)
  add(ReminderKind.BEFORE_MINUTES, notify.beforeMinutes * 60_000)

  return planned
}
