export function formatMoney(value) {
  return value.toLocaleString('ru-RU') + ' ₽'
}

// Русское склонение по числу: plural(5, 'занятие', 'занятия', 'занятий')
export function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

// Склонение слова «занятие» без самого числа: занятие / занятия / занятий
export function lessonsWord(n) {
  return plural(n, 'занятие', 'занятия', 'занятий')
}

// Русское склонение: 1 занятие, 2 занятия, 5 занятий
export function pluralLessons(n) {
  return `${n} ${lessonsWord(n)}`
}
