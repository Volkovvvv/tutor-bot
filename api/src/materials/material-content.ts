/**
 * Содержимое материалов урока: промпт, разбор ответа ИИ и шаблон-заглушка.
 * Без Nest и базы — чтобы проверять тестами.
 */

export interface TheoryBlock {
  h: string
  p: string
  /** Мини-пример в одну строку. */
  ex: string | null
}

export interface HomeworkItem {
  task: string
  /** «ЕГЭ · задание 13»; null — обычное задание на отработку темы. */
  tag: string | null
  /** Ответ с коротким решением — только для репетитора. */
  answer: string | null
}

export interface MaterialContent {
  /** Короткое название темы для заголовка; null — берём тему как ввёл репетитор. */
  title: string | null
  theory: TheoryBlock[]
  mistakes: string[]
  example: { task: string; solution: string }
  homework: HomeworkItem[]
}

export type StudyGoal = 'SCHOOL' | 'OGE' | 'EGE' | 'CE' | 'CT'
export type Country = 'RU' | 'BY'

export const HOMEWORK_COUNTS = [4, 6, 10] as const
export const DEFAULT_HOMEWORK_COUNT = 6

export interface PromptInput {
  subject: string
  topic: string
  grade: number | null
  goal: StudyGoal
  /** Страна репетитора: программа для учеников без экзамена. */
  country: Country
  homeworkCount: number
}

const GOAL_LABELS: Record<StudyGoal, string | null> = {
  SCHOOL: null,
  OGE: 'ОГЭ',
  EGE: 'ЕГЭ',
  CE: 'ЦЭ',
  CT: 'ЦТ',
}

/** «10 класс · ЕГЭ», «8 класс», «ЦЭ» или null. */
export function levelLabel(grade: number | null, goal: StudyGoal): string | null {
  return [grade ? `${grade} класс` : null, GOAL_LABELS[goal]].filter(Boolean).join(' · ') || null
}

const PROGRAMS: Record<Country, string> = {
  RU: 'российская школа',
  BY: 'белорусская школа (11 классов, 10-балльная система), термины — как в белорусских учебниках на русском языке',
}

// Экзамен задаёт страну сам: ЦЭ сдают в Беларуси, где бы ни жил репетитор.
const EXAMS: Record<Exclude<StudyGoal, 'SCHOOL'>, { country: Country; about: string; tag: string }> = {
  OGE: {
    country: 'RU',
    about: 'ОГЭ — экзамен за 9 класс в России',
    tag: '«ОГЭ · задание 12»',
  },
  EGE: {
    country: 'RU',
    about: 'ЕГЭ — экзамен за 11 класс в России',
    tag: '«ЕГЭ · задание 13»',
  },
  CE: {
    country: 'BY',
    about:
      'ЦЭ — централизованный экзамен в Беларуси: тест, в части A выбирают ответ из предложенных, в части B записывают краткий ответ',
    tag: '«ЦЭ · часть A» или «ЦЭ · часть B»',
  },
  CT: {
    country: 'BY',
    about:
      'ЦТ — централизованное тестирование в Беларуси: тест, в части A выбирают ответ из предложенных, в части B записывают краткий ответ',
    tag: '«ЦТ · часть A» или «ЦТ · часть B»',
  },
}

const SUBJECT_HINTS: Record<string, string> = {
  'Русский язык':
    'Теория — правила с примерами слов и предложений. Тип заданий выбирай по теме: орфография — вставить пропущенные буквы; пунктуация — расставить знаки в предложении, записанном без них; синтаксис и морфология — найти конструкцию, определить её границы, исправить ошибку в употреблении. Не давай заданий на орфографию, если тема про пунктуацию, и наоборот.',
  Английский:
    'Объяснения пиши по-русски, примеры и задания — на английском. Задания — упражнения на грамматику и лексику темы.',
  Математика: 'Задачи с конкретными числами и однозначным ответом.',
  Физика: 'Задачи с конкретными величинами и единицами измерения СИ.',
  Химия: 'Уравнения реакций — с коэффициентами и условиями. Названия веществ — по школьной номенклатуре на русском.',
}

/** Сколько последних заданий — в формате экзамена. */
function examTaskCount(homeworkCount: number): number {
  return homeworkCount >= 10 ? 3 : 2
}

export function buildMessages(input: PromptInput): { role: 'system' | 'user'; content: string }[] {
  const exam = input.goal === 'SCHOOL' ? null : EXAMS[input.goal]
  const n = input.homeworkCount

  const system = [
    'Ты опытный репетитор и методист. После урока готовишь ученику конспект-шпаргалку и домашнее задание.',
    '',
    'Язык:',
    '— Пиши по-русски, грамотно и коротко. К ученику обращайся только на «ты»: «реши», «найди», «запиши», «напиши». Формы на «вы» («решите», «напишите», «укажите») запрещены везде, включая условия задач.',
    '— Термины — как в школьных учебниках программы ученика. Не вставляй английские слова и латинские сокращения, если есть русский термин: «ИЮПАК», «н-бутан», «парабола».',
    '— Проверяй каждое вычисление, формулу и правило: ученик будет учиться по этому тексту.',
    '',
    'Формулы:',
    '— Только обычный текст с символами Unicode, без LaTeX и без markdown.',
    '— Степени и индексы — надстрочными и подстрочными знаками: x², 10⁻³, x₁, H₂SO₄, CₙH₂ₙ₊₂. Нельзя писать CH4, x^2, x_1.',
    '— Можно: → ↔ ↑ ↓ ° · × ÷ ± ≤ ≥ ≠ ≈ √ ∞ π Δ и греческие буквы. Знаки ⇄ ∠ ∈ ∪ ∩ не используй — пиши словами.',
    '',
    'Задания (пример и домашка):',
    '— Каждое задание — строго по теме урока и проверяет именно её.',
    '— В условии не должно быть ответа или подсказки к нему: никаких слов в скобках с правильным вариантом. Ответ — только в поле answer.',
    '— Текст печатается без жирного, курсива и подчёркивания. Не пиши «выделенное слово» или «подчёркнутое»: нужное слово набери ЗАГЛАВНЫМИ буквами прямо в предложении и сошлись на него так: «слово, записанное заглавными буквами».',
    '— Пропущенную букву обозначай двумя точками внутри слова: «бега..щий». В заданиях на пунктуацию давай предложение целиком без знаков, которые надо расставить.',
    '— У каждого задания один однозначный ответ, который можно проверить.',
    '— Задания не повторяют друг друга и разобранный пример: в каждом свои данные и свои предложения.',
    '',
    'Что написать:',
    '— title: название темы для заголовка, до 6 слов, без точки и без скобок.',
    '— theory: 3–4 блока. h — заголовок в 2–5 слов. p — само правило, определение или формула и одно пояснение, не больше двух предложений. ex — мини-пример в одну строку с конкретными данными.',
    '— mistakes: 2–3 типичные ошибки по теме, каждая одной фразой: что делают неправильно и как надо.',
    '— example: одна типовая задача и решение по шагам, шаги нумеруй «1) … 2) …».',
    `— homework: ровно ${n} заданий от простого к сложному. task — условие в одно-два предложения с конкретными данными, понятное без пояснений. answer — ответ и решение в одно-два предложения: его увидит только репетитор.`,
    exam
      ? `— Последние ${examTaskCount(n)} задания в homework — в формате экзамена (${exam.about}), с такой же формулировкой и такими же вариантами ответа, как на экзамене. В их tag напиши тип задания, например ${exam.tag}; если не уверен в номере — только название экзамена. У остальных заданий tag — null.`
      : '— tag у всех заданий — null.',
    '',
    'Верни ТОЛЬКО JSON без пояснений и без ```:',
    '{"title":"…","theory":[{"h":"…","p":"…","ex":"…"}],"mistakes":["…"],"example":{"task":"…","solution":"…"},"homework":[{"task":"…","tag":null,"answer":"…"}]}',
  ].join('\n')

  const level = input.subject === 'Математика' && input.goal === 'EGE' ? 'ЕГЭ, профильный уровень' : GOAL_LABELS[input.goal]
  const user = [
    `Предмет: ${input.subject}.`,
    input.grade ? `Ученик: ${input.grade} класс.` : null,
    `Программа: ${PROGRAMS[exam?.country ?? input.country]}.`,
    level ? `Цель: подготовка к экзамену — ${level}.` : 'Цель: школьная программа, экзамена нет.',
    `Тема урока: «${input.topic}».`,
    SUBJECT_HINTS[input.subject] ?? null,
  ]
    .filter(Boolean)
    .join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

const MAX_TEXT = 1200
const MAX_TITLE = 80

function text(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t || null
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/**
 * Проверяет форму материалов и отбрасывает лишнее.
 *
 * Через неё проходит и ответ модели, и JSON из базы: материалы, собранные
 * до появления ответов и типичных ошибок, хранят homework списком строк.
 * Возвращает null, если обязательных частей нет.
 */
export function coerceContent(data: unknown): MaterialContent | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  const theory = Array.isArray(d.theory)
    ? d.theory
        .map(record)
        .map((t) => ({ h: text(t.h), p: text(t.p), ex: text(t.ex) }))
        .filter((t): t is TheoryBlock => Boolean(t.h && t.p))
        .slice(0, 5)
    : []

  const mistakes = Array.isArray(d.mistakes)
    ? d.mistakes.map((m) => text(m)).filter((m): m is string => Boolean(m)).slice(0, 4)
    : []

  const ex = record(d.example)
  const task = text(ex.task)
  const solution = text(ex.solution)

  const homework = Array.isArray(d.homework)
    ? d.homework
        .map((item) => (typeof item === 'string' ? { task: item } : record(item)))
        .map((item) => ({ task: text(item.task), tag: text(item.tag, MAX_TITLE), answer: text(item.answer) }))
        .filter((item): item is HomeworkItem => Boolean(item.task))
        .slice(0, 12)
    : []

  if (theory.length === 0 || !task || !solution || homework.length === 0) return null
  return {
    title: text(d.title, MAX_TITLE),
    theory,
    mistakes,
    // Шаги «1) … 2) …» модель пишет в одну строку — разносим по строкам
    example: { task, solution: solution.replace(/\s+(?=\d+\)\s)/g, '\n') },
    homework,
  }
}

/**
 * Достаёт JSON из ответа модели.
 *
 * Бесплатные модели оборачивают JSON в ```, пишут рассуждения в <think>
 * и добавляют «Вот материалы:» — берём всё между первой { и последней }.
 * Возвращает null, если собрать валидные материалы не удалось.
 */
export function parseContent(raw: string): MaterialContent | null {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  try {
    return coerceContent(JSON.parse(cleaned.slice(start, end + 1)))
  } catch {
    return null
  }
}

/** Заглушка, пока не задан AI_API_KEY: показывает структуру PDF. */
export function templateContent(topic: string, homeworkCount = DEFAULT_HOMEWORK_COUNT): MaterialContent {
  const tasks = [
    'Задача на прямое применение правила.',
    'Задача с одним дополнительным шагом.',
    'Задача в формате экзамена.',
    'Задача со звёздочкой: объяснить решение своими словами.',
  ]
  return {
    title: null,
    theory: [
      { h: 'Главная идея', p: `Что такое «${topic}» и в каких задачах это встречается.`, ex: null },
      { h: 'Ключевые правила', p: 'Основные формулы и определения, которые нужно помнить наизусть.', ex: 'Мини-пример в одну строку.' },
      { h: 'Как применять', p: 'По шагам: с чего начать и как себя проверить.', ex: null },
    ],
    mistakes: ['На чём чаще всего теряют баллы и как надо делать.'],
    example: {
      task: `Базовая задача по теме «${topic}».`,
      solution: 'Пошаговое решение с пояснением каждого шага.',
    },
    homework: Array.from({ length: homeworkCount }, (_, i) => ({
      task: tasks[i % tasks.length],
      tag: null,
      answer: 'Ответ и короткое решение для репетитора.',
    })),
  }
}
