import { newId } from '../../../shared/lib/id.js'
import { currentMonthPrefix, fromMinutes, todayISO, toMinutes } from '../../../shared/lib/date.js'

export const LESSON_STATUSES = ['planned', 'done', 'cancelled']

export const STATUS_LABELS = {
  planned: 'В плане',
  done: 'Проведено',
  cancelled: 'Отменено',
}

export function createLesson({ studentId, date, time }) {
  return { id: newId(), studentId, date, time, duration: 60, status: 'planned', paid: false }
}

// Ближайшие сверху: по возрастанию даты и времени.
export function sortLessons(lessons) {
  const key = (l) => `${l.date} ${l.time}`
  return [...lessons].sort((a, b) => key(a).localeCompare(key(b)))
}

export function lessonsOn(lessons, date) {
  return sortLessons(lessons.filter((l) => l.date === date))
}

export function lessonEnd(lesson) {
  return fromMinutes(toMinutes(lesson.time) + (lesson.duration ?? 60))
}

// Цена занятия — снимок с сервера; у только что созданного его может не быть
export function lessonPrice(lesson, student) {
  return lesson.price ?? student?.price ?? 0
}

// Первое запланированное занятие дня, которое ещё не закончилось
export function nextLesson(dayLessons, now) {
  return dayLessons.find(
    (l) => l.status === 'planned' && toMinutes(l.time) + (l.duration ?? 60) > now
  )
}

// Бейдж строки расписания: что с занятием и что с деньгами
export function lessonBadge(lesson, isNext) {
  if (lesson.status === 'cancelled') return { label: 'Отменено', tone: 'neutral' }
  if (lesson.status === 'done' && !lesson.paid) return { label: 'Ждём оплату', tone: 'negative' }
  if (lesson.status === 'done') return { label: 'Оплачено', tone: 'paid' }
  if (isNext) return { label: 'Следующее', tone: 'positive' }
  return { label: 'В плане', tone: 'neutral' }
}

export function monthSummary(lessons, students) {
  const prefix = currentMonthPrefix()
  // Индекс по id: иначе на каждое занятие пришёлся бы поиск по всем ученикам
  const studentById = new Map(students.map((s) => [s.id, s]))

  let doneCount = 0
  let earned = 0
  let owed = 0

  for (const l of lessons) {
    if (!l.date.startsWith(prefix)) continue
    if (l.status !== 'done') continue
    doneCount += 1
    const price = lessonPrice(l, studentById.get(l.studentId))
    if (l.paid) earned += price
    else owed += price
  }

  return { doneCount, earned, owed }
}

// Итоги месяца по каждому ученику, самые «денежные» сверху
export function monthByStudent(lessons, students) {
  const prefix = currentMonthPrefix()
  const rows = new Map(students.map((s) => [s.id, { student: s, doneCount: 0, earned: 0, owed: 0 }]))

  for (const l of lessons) {
    const row = rows.get(l.studentId)
    if (!row || l.status !== 'done' || !l.date.startsWith(prefix)) continue
    row.doneCount += 1
    const price = lessonPrice(l, row.student)
    if (l.paid) row.earned += price
    else row.owed += price
  }

  return [...rows.values()].sort((a, b) => b.earned - a.earned || b.owed - a.owed)
}

// Занятия одного ученика + его итоги за один проход по массиву
export function studentLessons(lessons, student) {
  const own = []
  let doneCount = 0
  let owed = 0

  for (const l of lessons) {
    if (l.studentId !== student.id) continue
    own.push(l)
    if (l.status !== 'done') continue
    doneCount += 1
    if (!l.paid) owed += lessonPrice(l, student)
  }

  return { lessons: sortLessons(own), doneCount, owed }
}

export function upcomingLessons(lessons, studentId, limit = 5) {
  const today = todayISO()
  return sortLessons(
    lessons.filter((l) => l.studentId === studentId && l.status === 'planned' && l.date >= today)
  ).slice(0, limit)
}
