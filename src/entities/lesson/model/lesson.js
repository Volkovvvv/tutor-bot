import { newId } from '../../../shared/lib/id.js'
import { currentMonthPrefix } from '../../../shared/lib/date.js'

export const STATUS_LABELS = {
  planned: 'Запланировано',
  done: 'Прошло',
  cancelled: 'Отменено',
}

export function createLesson({ studentId, date, time }) {
  return { id: newId(), studentId, date, time, status: 'planned', paid: false }
}

// Ближайшие сверху: по возрастанию даты и времени.
export function sortLessons(lessons) {
  const key = (l) => `${l.date} ${l.time}`
  return [...lessons].sort((a, b) => key(a).localeCompare(key(b)))
}

export function monthSummary(lessons, students) {
  const prefix = currentMonthPrefix()
  // Индекс по id: иначе на каждое занятие пришёлся бы поиск по всем ученикам
  const priceById = new Map(students.map((s) => [s.id, s.price]))

  let doneCount = 0
  let earned = 0
  let owed = 0

  for (const l of lessons) {
    if (!l.date.startsWith(prefix)) continue
    if (l.status !== 'done') continue
    doneCount += 1
    const price = priceById.get(l.studentId) ?? 0
    if (l.paid) earned += price
    else owed += price
  }

  return { doneCount, earned, owed }
}

// Занятия одного ученика + его итоги за один проход по массиву
export function studentLessons(lessons, student) {
  const own = []
  let doneCount = 0
  let unpaidCount = 0

  for (const l of lessons) {
    if (l.studentId !== student.id) continue
    own.push(l)
    if (l.status !== 'done') continue
    doneCount += 1
    if (!l.paid) unpaidCount += 1
  }

  return { lessons: sortLessons(own), doneCount, owed: unpaidCount * student.price }
}

export function upcomingLessons(lessons, studentId, limit = 5) {
  const nowKey = `${new Date().toISOString().slice(0, 10)} 00:00`
  return sortLessons(
    lessons.filter(
      (l) => l.studentId === studentId && l.status === 'planned' && `${l.date} ${l.time}` >= nowKey
    )
  ).slice(0, limit)
}
