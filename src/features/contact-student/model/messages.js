import { formatDate } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'

export function scheduleMessage(student, upcoming) {
  if (upcoming.length === 0) {
    return `${student.name}, привет! Пока новых занятий не запланировано.`
  }
  const lines = upcoming.map((l) => `• ${formatDate(l.date)} в ${l.time}`)
  return `${student.name}, привет! Ближайшие занятия:\n${lines.join('\n')}`
}

export function debtMessage(student, owed) {
  return `${student.name}, привет! Напоминаю об оплате: ${formatMoney(owed)}.`
}
