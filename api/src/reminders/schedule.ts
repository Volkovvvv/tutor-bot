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
): PlannedReminder[] {
  if (!notify.enabled) return []

  const planned: PlannedReminder[] = []

  const add = (kind: ReminderKind, offsetMs: number): void => {
    if (offsetMs <= 0) return
    const scheduledAt = new Date(startsAt.getTime() - offsetMs)
    // Момент отправки уже прошёл — напоминание бессмысленно.
    // Иначе создание занятия «на завтра» с напоминанием за неделю
    // мгновенно отправляло бы просроченное уведомление.
    if (scheduledAt <= now) return
    planned.push({ kind, scheduledAt })
  }

  add(ReminderKind.BEFORE_HOURS, notify.beforeHours * 3_600_000)
  add(ReminderKind.BEFORE_MINUTES, notify.beforeMinutes * 60_000)

  return planned
}
