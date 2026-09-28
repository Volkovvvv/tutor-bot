// date хранится как YYYY-MM-DD, time как HH:MM

const pad = (n) => String(n).padStart(2, '0')

export function formatDate(date) {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

export function isoOf(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Локальная полночь: new Date('YYYY-MM-DD') трактуется как UTC и в западных
// таймзонах уезжает на день назад
export function parseISO(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  return isoOf(new Date())
}

export function addDays(date, n) {
  const d = parseISO(date)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

// Семь дат недели, в которую попадает date, с понедельника
export function weekOf(date) {
  const shift = (parseISO(date).getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => addDays(date, i - shift))
}

// «Понедельник, 28 сентября»
export function dayTitle(date) {
  const s = parseISO(date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return s[0].toUpperCase() + s.slice(1)
}

// «28 сентября»
export function dayMonth(date) {
  return parseISO(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export function weekdayShort(date) {
  return WEEKDAYS[parseISO(date).getDay()]
}

export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(minutes) {
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`
}

export function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function currentMonthPrefix() {
  return todayISO().slice(0, 7) // YYYY-MM
}

export function monthTitle() {
  return new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

// «сентябрь» — для «заработано за сентябрь»
export function monthName() {
  return new Date().toLocaleDateString('ru-RU', { month: 'long' })
}
