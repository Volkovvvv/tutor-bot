/**
 * Проверка ключа ответов: второе решение тех же заданий и сверка с ключом.
 * Без Nest и базы — чтобы проверять тестами.
 *
 * Запросов два. Первый решает задания, не видя ключа: если показать ключ,
 * модель с ним согласится. Второй сверяет два ответа по смыслу — «0,5» и
 * «1/2» кодом не сравнить. Расхождение не правит ответ, а помечает задание:
 * кто из двоих ошибся, решает репетитор.
 */
import { extractJson, type MaterialContent } from './material-content'
import { canonicalSubject } from './subjects'

type Message = { role: 'system' | 'user'; content: string }

// Предметы, где проверка себя показала. В русском она ловит то, чего глазами
// легко не заметить: слово, которого нет («листья опадаются»), и пропуск
// не на месте. Остальные языки не проверяли: там ответ — фраза, и сверка
// по смыслу может поднимать ложную тревогу.
const CHECKED_SUBJECTS = new Set(['Математика', 'Физика', 'Русский язык'])

export function isCheckedSubject(subject: string): boolean {
  return CHECKED_SUBJECTS.has(canonicalSubject(subject))
}

/** Задание с ответом из ключа. */
export interface CheckItem {
  task: string
  key: string
}

/** Что сверяем: разобранный пример и задания домашки, у которых есть ответ. */
export function checkItems(content: MaterialContent): CheckItem[] {
  return [
    { task: content.example.task, key: content.example.solution },
    ...content.homework.filter((h) => h.answer).map((h) => ({ task: h.task, key: h.answer as string })),
  ]
}

export function buildSolveMessages(subject: string, grade: number | null, items: CheckItem[]): Message[] {
  const system = [
    'Ты решаешь школьные задания, чтобы проверить ключ ответов. Ошибка в ключе дорого стоит, поэтому решай внимательно, по шагам, и перепроверяй вычисления.',
    'Если задание решить нельзя — данных не хватает, они противоречат друг другу или в условии стоит слово, которого нет в языке, — не подгоняй ответ, а напиши в answer, что именно не так.',
    'Две точки внутри слова («собира..ся») — место пропуска: букв там может быть одна или несколько.',
    'Верни ТОЛЬКО JSON без пояснений и без ```:',
    '{"solved":[{"n":1,"answer":"итоговый ответ и решение в одну-две строки"}]}',
  ].join('\n')
  const user = [
    `Предмет: ${subject}.`,
    grade ? `Ученик: ${grade} класс.` : null,
    '',
    ...items.map((item, i) => `${i + 1}. ${item.task}`),
  ]
    .filter((line) => line !== null)
    .join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Ответы проверяющего по номерам заданий; null — ответ модели не разобран. */
export function parseSolved(raw: string, count: number): (string | null)[] | null {
  const data = extractJson(raw)
  const solved = data && typeof data === 'object' ? (data as { solved?: unknown }).solved : null
  if (!Array.isArray(solved)) return null

  const answers: (string | null)[] = Array.from({ length: count }, () => null)
  for (const row of solved) {
    const { n, answer } = (row ?? {}) as { n?: unknown; answer?: unknown }
    if (typeof n === 'number' && n >= 1 && n <= count && typeof answer === 'string' && answer.trim()) {
      answers[n - 1] = answer.trim()
    }
  }
  return answers.some(Boolean) ? answers : null
}

export function buildCompareMessages(items: CheckItem[], own: (string | null)[]): Message[] {
  const system = [
    'Ты сверяешь ключ ответов к школьным заданиям с независимым решением. Для каждого задания даны условие, ответ из ключа (key) и ответ проверяющего (own).',
    'Ответы совпадают, если итог одинаков по смыслу: «0,5» и «1/2», «3 м/с²» и «a = 3 м/с² вправо», корни в другом порядке. Разница в оформлении и подробности — не расхождение.',
    'Расхождение — когда итог разный или когда проверяющий пишет, что задание не решается. Для каждого расхождения напиши note репетитору одной фразой по-русски: что получилось у проверки и что стоит в ключе. Не утверждай, кто прав.',
    'Верни ТОЛЬКО JSON без пояснений и без ```: {"doubts":[{"n":2,"note":"…"}]}. Расхождений нет — {"doubts":[]}.',
  ].join('\n')
  const user = items
    .map((item, i) => (own[i] ? { n: i + 1, task: item.task, key: item.key, own: own[i] } : null))
    .filter(Boolean)
    .map((row) => JSON.stringify(row))
    .join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

const NOTE_MAX = 300

/** Пометки по номерам заданий; null — ответ модели не разобран. */
export function parseDoubts(raw: string, count: number): (string | null)[] | null {
  const data = extractJson(raw)
  const doubts = data && typeof data === 'object' ? (data as { doubts?: unknown }).doubts : null
  if (!Array.isArray(doubts)) return null

  const notes: (string | null)[] = Array.from({ length: count }, () => null)
  for (const row of doubts) {
    const { n, note } = (row ?? {}) as { n?: unknown; note?: unknown }
    if (typeof n === 'number' && n >= 1 && n <= count && typeof note === 'string' && note.trim()) {
      notes[n - 1] = note.trim().slice(0, NOTE_MAX)
    }
  }
  return notes
}

const sameItem = (a: CheckItem, b: CheckItem) => a.task === b.task && a.key === b.key

/**
 * Записывает итог проверки в материал.
 *
 * Пока шла проверка, репетитор мог поправить текст, поэтому пометки ищут
 * своё задание по условию и ответу, а не по номеру: исправленному заданию
 * пометка о старом ответе не нужна.
 */
export function applyDoubts(content: MaterialContent, checked: CheckItem[], notes: (string | null)[]): MaterialContent {
  const noteFor = (item: CheckItem) => {
    const i = checked.findIndex((c) => sameItem(c, item))
    return i === -1 ? null : notes[i]
  }
  return {
    ...content,
    check: 'done',
    example: {
      ...content.example,
      doubt: noteFor({ task: content.example.task, key: content.example.solution }),
    },
    homework: content.homework.map((h) => ({
      ...h,
      doubt: h.answer ? noteFor({ task: h.task, key: h.answer }) : null,
    })),
  }
}

/**
 * Переносит итог проверки в материал после правок репетитора: форма правки
 * пометок не присылает. Пометка остаётся, пока не тронуты условие и ответ.
 */
export function carryDoubts(prev: MaterialContent, next: MaterialContent): MaterialContent {
  const doubted = [
    { task: prev.example.task, key: prev.example.solution, doubt: prev.example.doubt },
    ...prev.homework.map((h) => ({ task: h.task, key: h.answer ?? '', doubt: h.doubt })),
  ].filter((item) => item.doubt)
  const doubtFor = (task: string, key: string | null) =>
    doubted.find((item) => item.task === task && item.key === (key ?? ''))?.doubt ?? null

  return {
    ...next,
    check: prev.check,
    example: { ...next.example, doubt: doubtFor(next.example.task, next.example.solution) },
    homework: next.homework.map((h) => ({ ...h, doubt: doubtFor(h.task, h.answer) })),
  }
}
