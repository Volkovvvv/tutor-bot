/**
 * Тексты напоминаний.
 *
 * Время показываем в таймзоне репетитора: он ставит занятия в своём
 * времени, и «16:00» в сообщении должно совпадать с тем, что он видит
 * в приложении.
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

export function lessonReminderText(
  studentName: string,
  startsAt: Date,
  timezone: string,
  isSoon: boolean,
): string {
  const time = formatTime(startsAt, timezone)

  if (isSoon) {
    return `${studentName}, напоминаю: занятие сегодня в ${time}.`
  }
  return `${studentName}, напоминаю: занятие ${formatDate(startsAt, timezone)} в ${time}.`
}

/** Сумма из копеек в читаемые рубли. */
export function formatMoney(kopecks: number): string {
  const rubles = kopecks / 100
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    // Копейки показываем только когда они есть: «1500 ₽» вместо «1500,00 ₽».
    minimumFractionDigits: kopecks % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rubles)
}

export function debtReminderText(
  studentName: string,
  lessonCount: number,
  totalKopecks: number,
): string {
  const lessons = pluralize(lessonCount, 'занятие', 'занятия', 'занятий')
  return (
    `${studentName}, напоминаю об оплате: ${lessonCount} ${lessons} ` +
    `на сумму ${formatMoney(totalKopecks)}.`
  )
}

/** Русская форма числительного: 1 занятие, 2 занятия, 5 занятий. */
function pluralize(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = n % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
