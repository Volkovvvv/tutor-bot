/**
 * Проверка материала: ключ ответов и теория.
 * Без Nest и базы — чтобы проверять тестами.
 *
 * Ключ: два запроса. Первый решает задания, не видя ключа: если показать ключ,
 * модель с ним согласится. Второй сверяет два ответа по смыслу — «0,5» и
 * «1/2» кодом не сравнить. Расхождение не правит ответ, а помечает задание:
 * кто из двоих ошибся, решает репетитор.
 *
 * По математике часть заданий до модели не доходит: уравнения, неравенства и
 * «вычисли» сверяет подстановкой код (math-check). Он не ошибается в счёте и
 * ничего не стоит, но берёт только то, что читается однозначно.
 *
 * Теория: один запрос, который ищет в конспекте то, из-за чего ученик узнает
 * неверное: ошибочное правило, правило шире, чем верно, пример против правила,
 * спорную норму как единственную. Находки тоже только помечают блок.
 */
import { extractJson, type MaterialContent } from './material-content'
import { mathCheck } from './math-check'
import { canonicalSubject } from './subjects'

type Message = { role: 'system' | 'user'; content: string }

// Предметы, где проверка себя показала. В русском она ловит то, чего глазами
// легко не заметить: слово, которого нет («листья опадаются»), и пропуск
// не на месте. В английском ответ — слово или фраза, и сверка может поднимать
// ложную тревогу на «haven't» и «have not» — об этом сказано в запросе, но
// долю ложных тревог на живых материалах ещё не мерили.
const CHECKED_SUBJECTS = new Set(['Математика', 'Физика', 'Русский язык', 'Английский'])

export function isCheckedSubject(subject: string): boolean {
  return CHECKED_SUBJECTS.has(canonicalSubject(subject))
}

/** Задание с ответом из ключа. */
export interface CheckItem {
  task: string
  key: string
  /** Итоговый ответ короткой записью, если модель его дала: для проверки подстановкой. */
  result?: string | null
}

/** Что сверяем: разобранный пример и задания домашки, у которых есть ответ. */
export function checkItems(content: MaterialContent): CheckItem[] {
  return [
    { task: content.example.task, key: content.example.solution, result: content.example.result },
    ...content.homework.filter((h) => h.answer).map((h) => ({ task: h.task, key: h.answer as string, result: h.result })),
  ]
}

/**
 * Что о каждом задании сказала проверка подстановкой: пометка; null — ключ
 * сошёлся; undefined — код задание не взял, его проверит модель.
 */
export function codeNotes(subject: string, items: CheckItem[]): (string | null | undefined)[] {
  if (canonicalSubject(subject) !== 'Математика') return items.map(() => undefined)
  return items.map((item) => {
    const verdict = mathCheck(item.task, item.key, item.result)
    return verdict ? (verdict.ok ? null : verdict.note) : undefined
  })
}

/** Сводит пометки кода и модели в один список по номерам заданий; rest — пометки модели к заданиям, которые код не взял. */
export function mergeNotes(byCode: (string | null | undefined)[], rest: (string | null)[] | null): (string | null)[] {
  let next = 0
  return byCode.map((note) => (note === undefined ? (rest?.[next++] ?? null) : note))
}

export function buildSolveMessages(
  subject: string,
  grade: number | null,
  items: CheckItem[],
  // Тема нужна, чтобы понять, что проверяет пропуск: без неё «пр..шила» читается и как «прошила»
  topic?: string,
): Message[] {
  const system = [
    'Ты решаешь школьные задания, чтобы проверить ключ ответов. Ошибка в ключе дорого стоит, поэтому решай внимательно, по шагам, и перепроверяй вычисления.',
    'Если задание решить нельзя — данных не хватает, они противоречат друг другу или в условии стоит слово, которого нет в языке, — не подгоняй ответ, а напиши в answer, что именно не так.',
    'Две точки внутри слова («собира..ся») — место пропуска: букв там может быть одна или несколько.',
    'Задания проверяют тему урока: пропуск или выбор относится к ней. Ориентируйся на школьную норму, а не на разговорную речь.',
    'Неоднозначным считай только задание, где два разных ответа одинаково подходят и по теме урока, и по смыслу предложения: тогда напиши оба через «или» и отметь это. Натянутые варианты не предлагай.',
    'Верни ТОЛЬКО JSON без пояснений и без ```:',
    '{"solved":[{"n":1,"answer":"итоговый ответ и решение в одну-две строки"}]}',
  ].join('\n')
  const user = [
    `Предмет: ${subject}.`,
    grade ? `Ученик: ${grade} класс.` : null,
    topic ? `Тема урока: «${topic}».` : null,
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
    'Ответы совпадают, если итог одинаков по смыслу: «0,5» и «1/2», «3 м/с²» и «a = 3 м/с² вправо», корни в другом порядке. Разница в оформлении и подробности — не расхождение. Краткая и полная формы («haven\'t» и «have not») — один и тот же ответ.',
    'Если проверяющий пишет, что задание допускает ещё один, другой по смыслу или по грамматике ответ, — это расхождение: напиши в note, что задание неоднозначно.',
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
  // Замечание к блоку теории живёт, пока блок не тронут; общее — пока не тронуты ошибки и разбор
  const sameBlock = (a: MaterialContent['theory'][number], b: MaterialContent['theory'][number]) =>
    a.h === b.h && a.p === b.p && (a.rule ?? '') === (b.rule ?? '') && (a.ex ?? '') === (b.ex ?? '')
  const tail = (c: MaterialContent) => JSON.stringify([c.mistakes, c.example.task, c.example.solution])

  const doubted = [
    { task: prev.example.task, key: prev.example.solution, doubt: prev.example.doubt },
    ...prev.homework.map((h) => ({ task: h.task, key: h.answer ?? '', doubt: h.doubt })),
  ].filter((item) => item.doubt)
  const doubtFor = (task: string, key: string | null) =>
    doubted.find((item) => item.task === task && item.key === (key ?? ''))?.doubt ?? null

  return {
    ...next,
    check: prev.check,
    theory: next.theory.map((t) => ({ ...t, doubt: prev.theory.find((p) => sameBlock(p, t))?.doubt ?? null })),
    theoryDoubt: tail(prev) === tail(next) ? (prev.theoryDoubt ?? null) : null,
    example: { ...next.example, doubt: doubtFor(next.example.task, next.example.solution) },
    homework: next.homework.map((h) => ({ ...h, doubt: doubtFor(h.task, h.answer) })),
  }
}

// ─── Проверка теории ───

export interface TheoryFinding {
  /** Заголовок блока теории, к которому относится замечание, или название раздела. */
  block: string
  note: string
}

const FINDINGS_MAX = 3
const BLOCK_MAX = 120
const FINDING_NOTE_MAX = 400

export function buildTheoryCheckMessages(
  subject: string,
  grade: number | null,
  topic: string,
  content: MaterialContent,
): Message[] {
  const system = [
    'Ты строгий методист-предметник и редактор школьных учебников. Проверь конспект для школьника: по нему ученик будет учиться.',
    'Шаг 1 — сверь примеры с правилами. Для каждого блока возьми его правило и по очереди каждый пример из этого блока, а также относящиеся к нему примеры из типичных ошибок и разбора. Примени правило к примеру буквально. Если по правилу получается не то, что написано в примере, — это находка: правило неполное или пример неверный.',
    'Шаг 2 — проверь остальное:',
    '1) неверный факт, правило, формула, пример или вычисление;',
    '2) пропущено исключение или особая форма, которые в школе дают вместе с этим правилом в этом же классе, и без них ученик ошибётся в обычном задании по теме;',
    '3) одно место конспекта противоречит другому;',
    '4) норма спорная или устаревшая, а подана как единственно верная.',
    'Не отмечай: стиль, терминологию, неполноту, с которой можно жить, нехватку примеров, длину, «можно было бы лучше»; исключения и тонкости из углублённого курса или следующих классов; случаи, которых эта тема в школе не касается. Конспект короткий и не обязан перечислять всё. Сомневаешься, что это ошибка, — не отмечай.',
    'Для каждой находки: block — заголовок блока теории дословно (для типичных ошибок «Типичные ошибки», для разбора «Разбор примера»); note — одна-две короткие фразы по-русски: что не так и как верно.',
    'Верни ТОЛЬКО JSON без пояснений и без ```: {"findings":[{"block":"…","note":"…"}]}. Ошибок нет — {"findings":[]}. Не больше трёх находок.',
  ].join('\n')

  const summary = {
    theory: content.theory.map(({ h, p, rule, ex }) => ({ h, p, rule, ex })),
    mistakes: content.mistakes,
    example: { task: content.example.task, solution: content.example.solution },
  }
  const user = [
    `Предмет: ${subject}.`,
    grade ? `Ученик: ${grade} класс.` : null,
    `Тема урока: «${topic}».`,
    '',
    'Конспект:',
    JSON.stringify(summary, null, 1),
  ]
    .filter((line) => line !== null)
    .join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Находки проверяющего; пустой список — замечаний нет; null — ответ модели не разобран. */
export function parseTheoryFindings(raw: string): TheoryFinding[] | null {
  const data = extractJson(raw)
  const findings = data && typeof data === 'object' ? (data as { findings?: unknown }).findings : null
  if (!Array.isArray(findings)) return null

  return findings
    .map((row) => {
      const { block, note } = (row ?? {}) as { block?: unknown; note?: unknown }
      return {
        block: typeof block === 'string' ? block.trim().slice(0, BLOCK_MAX) : '',
        note: typeof note === 'string' ? note.trim().slice(0, FINDING_NOTE_MAX) : '',
      }
    })
    .filter((f) => f.note)
    .slice(0, FINDINGS_MAX)
}

const normTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"“”.:;!?\s]+/g, ' ')
    .trim()

/**
 * Раскладывает находки по блокам теории по заголовку; что не нашло блок
 * (типичные ошибки, разбор, неточный заголовок), идёт общей пометкой.
 * Прежние пометки теории заменяются: проверка каждый раз новая.
 */
export function applyTheoryFindings(content: MaterialContent, findings: TheoryFinding[]): MaterialContent {
  const theory = content.theory.map((t) => ({ ...t, doubt: null as string | null }))
  const general: string[] = []

  for (const f of findings) {
    const wanted = normTitle(f.block)
    const i = wanted
      ? theory.findIndex((t) => {
          const title = normTitle(t.h)
          if (title === wanted) return true
          // Неполное совпадение — только для заголовков, где совпасть случайно трудно
          return title.length >= 4 && wanted.length >= 4 && (wanted.includes(title) || title.includes(wanted))
        })
      : -1
    if (i >= 0) theory[i].doubt = [theory[i].doubt, f.note].filter(Boolean).join(' ')
    else general.push(f.block ? `${f.block}: ${f.note}` : f.note)
  }

  return { ...content, theory, theoryDoubt: general.length ? general.join(' ') : null }
}
