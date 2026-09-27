export function formatMoney(value) {
  return value.toLocaleString('ru-RU') + ' ₽'
}

// Русское склонение: 1 занятие, 2 занятия, 5 занятий
export function pluralLessons(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} занятие`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} занятия`
  return `${n} занятий`
}
