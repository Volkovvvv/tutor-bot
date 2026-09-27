// date хранится как YYYY-MM-DD, time как HH:MM

export function formatDate(date) {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

export function todayISO() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function currentMonthPrefix() {
  return todayISO().slice(0, 7) // YYYY-MM
}

export function monthTitle() {
  return new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
