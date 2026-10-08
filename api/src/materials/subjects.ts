/**
 * Название предмета, по которому ищем карточки формата, программы и учебника.
 *
 * Предмет репетитор может ввести руками, поэтому перечисления нет:
 * известные написания сводим к одному, незнакомые оставляем как есть.
 */
const ALIASES: Record<string, string> = {
  математика: 'Математика',
  алгебра: 'Математика',
  геометрия: 'Математика',
  'алгебра и геометрия': 'Математика',
  'русский язык': 'Русский язык',
  русский: 'Русский язык',
  английский: 'Английский',
  'английский язык': 'Английский',
  физика: 'Физика',
  химия: 'Химия',
  биология: 'Биология',
  информатика: 'Информатика',
}

export function canonicalSubject(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return ALIASES[key] ?? name.trim()
}

// Oswald не знает греческих букв — такой знак печатаем шрифтом текста
const SIGNS: Record<string, { text: string; font: 'display-semi' | 'body-semi' }> = {
  Физика: { text: 'Ω', font: 'body-semi' },
  Английский: { text: 'Aa', font: 'display-semi' },
  'Русский язык': { text: 'Яя', font: 'display-semi' },
}

/** Декоративный знак в шапке листа; у математики и незнакомых предметов — «÷». */
export function subjectSign(name: string): { text: string; font: 'display-semi' | 'body-semi' } {
  return SIGNS[canonicalSubject(name)] ?? { text: '÷', font: 'display-semi' }
}
