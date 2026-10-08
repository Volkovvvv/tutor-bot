import { addDays, isoOf, parseISO } from '../../../shared/lib/date.js'

// Значение выбора ученика в строке черновика: «создать нового»
export const NEW_STUDENT = 'new'

export const WEEKDAY_OPTIONS = [
  [1, 'Понедельник'],
  [2, 'Вторник'],
  [3, 'Среда'],
  [4, 'Четверг'],
  [5, 'Пятница'],
  [6, 'Суббота'],
  [7, 'Воскресенье'],
]

export const REPEAT_OPTIONS = [
  { value: true, label: 'Каждую неделю' },
  { value: false, label: 'Только ближайшая неделя' },
]

// «Маша К.» и «маша к» — одно и то же имя
export function nameKey(name) {
  return name
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ученик, которому соответствует имя из расписания, или null.
 *
 * Совпадение — только однозначное: «Маша» при двух Машах не подставляется.
 * Ошибиться здесь хуже, чем не угадать: занятие и напоминание ушли бы
 * не тому ученику, а «нового» репетитор заменит сам одним выбором.
 */
export function matchStudent(name, students) {
  const key = nameKey(name)
  if (!key) return null

  const exact = students.filter((st) => nameKey(st.name) === key)
  if (exact.length === 1) return exact[0].id
  if (exact.length > 1) return null

  // «Маша» и «Маша К.» → «Маша Кузнецова»: каждое слово — начало слова в имени ученика
  const words = key.split(' ')
  const partial = students.filter((st) => {
    const own = nameKey(st.name).split(' ')
    return words.length <= own.length && words.every((w, i) => own[i].startsWith(w))
  })
  return partial.length === 1 ? partial[0].id : null
}

// Строки с сервера → строки черновика, которые правит репетитор
export function toDraft(rows, students) {
  return rows.map((row, i) => ({
    key: i,
    // Как было в расписании — показываем рядом с выбором, чтобы было с чем сверить
    source: row.name,
    name: row.name,
    studentId: matchStudent(row.name, students) ?? NEW_STUDENT,
    weekday: row.weekday,
    time: row.time ?? '',
    duration: row.duration,
    unsure: row.unsure,
    on: true,
  }))
}

export function isRowValid(row) {
  if (!row.weekday || !/^\d{2}:\d{2}$/.test(row.time)) return false
  return row.studentId !== NEW_STUDENT || row.name.trim().length > 0
}

// Новые ученики черновика: по одному на имя, даже если оно в нескольких строках
export function newStudentsOf(rows) {
  const byKey = new Map()
  for (const row of rows) {
    if (!row.on || row.studentId !== NEW_STUDENT || !isRowValid(row)) continue
    const key = nameKey(row.name)
    if (key && !byKey.has(key)) byKey.set(key, { key, name: row.name.trim() })
  }
  return [...byKey.values()]
}

// Ближайшая дата с этим днём недели, занятие в которую ещё не началось
function firstDate(weekday, time, now) {
  const today = isoOf(now)
  // getDay(): 0 — воскресенье; в расписании воскресенье — 7
  const shift = (weekday - ((now.getDay() + 6) % 7) - 1 + 7) % 7
  const date = addDays(today, shift)
  const [h, m] = time.split(':').map(Number)
  const start = parseISO(date)
  start.setHours(h, m, 0, 0)
  return start > now ? date : addDays(date, 7)
}

/**
 * Ближайшее занятие по каждой строке черновика. При «каждую неделю» оно же —
 * первое занятие серии: остальные создаёт сервер.
 *
 * У нового ученика вместо studentId — studentKey: id появится только
 * после создания карточки на сервере.
 */
export function buildLessons(rows, now = new Date()) {
  const lessons = []
  for (const row of rows) {
    if (!row.on || !isRowValid(row)) continue
    lessons.push({
      studentId: row.studentId === NEW_STUDENT ? null : row.studentId,
      studentKey: row.studentId === NEW_STUDENT ? nameKey(row.name) : null,
      date: firstDate(row.weekday, row.time, now),
      time: row.time,
      duration: row.duration ?? undefined,
    })
  }
  return lessons
}
