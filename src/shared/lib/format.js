// Валюта репетитора зависит от страны в профиле: Россия — рубли, Беларусь — BYN.
// Хранится здесь, а не в контексте React: форматируют деньги два десятка мест,
// и протаскивать валюту в каждое пришлось бы пропсом. App задаёт её при каждом
// рендере (setCurrency идемпотентна), поэтому экраны всегда видят актуальную.
const CURRENCY_SIGNS = { RU: '₽', BY: 'BYN' }
let sign = CURRENCY_SIGNS.RU

export function setCurrency(country) {
  sign = CURRENCY_SIGNS[country] ?? CURRENCY_SIGNS.RU
}

/** Знак валюты для подписей полей ввода: «Цена за занятие, ₽». */
export function currencySign() {
  return sign
}

export function formatMoney(value) {
  return `${value.toLocaleString('ru-RU')} ${sign}`
}

// Подпись пробного лимита ИИ: «Осталось 3 из 10 материалов».
// quota — { used, limit } из профиля; без лимита (или профиль старый) — пусто.
export function quotaLeft(quota, many) {
  if (!quota || quota.limit === null) return ''
  const left = Math.max(0, quota.limit - quota.used)
  return `Осталось ${left} из ${quota.limit} ${many}`
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
