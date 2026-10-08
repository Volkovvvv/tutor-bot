/**
 * Тексты напоминаний.
 *
 * Время показываем в таймзоне репетитора: он ставит занятия в своём
 * времени, и «16:00» в сообщении должно совпадать с тем, что он видит
 * в приложении. Рядом подписываем пояс — см. zoneLabel.
 */

/** Час и минуты занятия в указанной таймзоне. */
function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date)
}

function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  }).format(date)
}

// Привычные названия; остальным поясам — смещение от UTC
const ZONE_NAMES: Record<string, string> = {
  'Europe/Moscow': 'мск',
  'Europe/Minsk': 'по Минску',
}

/**
 * Чьё это время: «мск» или «UTC+5».
 *
 * Пояс ученика бот узнать не может, а занятия онлайн часто идут через
 * несколько поясов: «в 16:00» без уточнения ученик прочтёт по своим часам.
 */
export function zoneLabel(date: Date, timezone: string): string {
  if (ZONE_NAMES[timezone]) return ZONE_NAMES[timezone]
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value
  // «GMT+5» → «UTC+5»; у нулевого смещения движки пишут то «GMT», то «GMT+0»
  return (offset ?? 'GMT').replace('GMT', 'UTC').replace(/[+-]0$/, '')
}

/** Календарный день в таймзоне числом суток от эпохи — чтобы сравнивать дни. */
function dayNumber(date: Date, timezone: string): number {
  // en-CA даёт «2026-10-05»
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/**
 * «Сегодня», «завтра» или дата — по тому, когда сообщение уходит на самом деле:
 * тихие часы могут сдвинуть напоминание «за час» на вечер накануне.
 */
export function lessonReminderText(
  studentName: string,
  startsAt: Date,
  timezone: string,
  now: Date,
): string {
  const time = formatTime(startsAt, timezone)
  const days = dayNumber(startsAt, timezone) - dayNumber(now, timezone)
  const day = days === 0 ? 'сегодня' : days === 1 ? 'завтра' : formatDate(startsAt, timezone)
  return `${studentName}, напоминаю: занятие ${day} в ${time} ${zoneLabel(startsAt, timezone)}.`
}
