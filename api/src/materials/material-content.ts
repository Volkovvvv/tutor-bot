/**
 * Содержимое материалов урока: промпт, разбор ответа ИИ и шаблон-заглушка.
 * Без Nest и базы — чтобы проверять тестами.
 */
import { examFormat } from './exam-formats'
import { program } from './programs'
import { canonicalSubject } from './subjects'
import { textbook } from './textbooks'
import { styleExemplars } from './exemplars'

export interface TheoryBlock {
  h: string
  /** Объяснение простыми словами, как сказал бы репетитор. */
  p: string
  /** Само правило или формула одной строкой — для запоминания. */
  rule: string | null
  /** Мини-пример в одну строку. */
  ex: string | null
}

export interface HomeworkItem {
  task: string
  /** «ЕГЭ», «ЦЭ · часть B»; null — обычное задание на отработку темы. */
  tag: string | null
  /** Ответ с коротким решением — только для репетитора. */
  answer: string | null
  /** Проверка ответов получила другой результат: что именно, одной фразой. Только для репетитора. */
  doubt?: string | null
}

/** Проверка ключа ответов вторым решением: идёт, закончена или не удалась. */
export type CheckStatus = 'pending' | 'done' | 'failed'
const CHECK_STATUSES: readonly string[] = ['pending', 'done', 'failed']

export interface MaterialContent {
  /** Короткое название темы для заголовка; null — берём тему как ввёл репетитор. */
  title: string | null
  theory: TheoryBlock[]
  mistakes: string[]
  example: { task: string; solution: string; doubt?: string | null }
  homework: HomeworkItem[]
  /** null или нет поля — ответы не проверялись: предмет без проверки или старый материал. */
  check?: CheckStatus | null
}

export type StudyGoal = 'SCHOOL' | 'OGE' | 'EGE' | 'CE' | 'CT'
export type Country = 'RU' | 'BY'

export const HOMEWORK_COUNTS = [4, 6, 10] as const
export const DEFAULT_HOMEWORK_COUNT = 6
export const WISHES_MAX = 500

/** Лимит материалов на репетитора из настройки AI_MATERIALS_LIMIT; null — без лимита. */
export function materialsLimit(raw: unknown): number | null {
  const limit = Number(raw)
  return Number.isInteger(limit) && limit > 0 ? limit : null
}

export const REASONING_EFFORTS = ['low', 'medium', 'high', 'none'] as const
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number]

/**
 * Уровень рассуждений модели из настройки AI_REASONING_EFFORT.
 * none — не просить рассуждений вовсе; пусто или опечатка — high:
 * с ошибкой в настройке сервер должен работать как раньше, а не падать.
 */
export function reasoningEffort(raw: unknown): ReasoningEffort {
  const value = String(raw ?? '').trim().toLowerCase()
  return (REASONING_EFFORTS as readonly string[]).includes(value) ? (value as ReasoningEffort) : 'high'
}

export interface PromptInput {
  subject: string
  topic: string
  grade: number | null
  goal: StudyGoal
  /** Страна репетитора: программа для учеников без экзамена. */
  country: Country
  homeworkCount: number
  /** Пожелания репетитора к этому материалу: «больше текстовых задач», «без дробей». */
  wishes?: string | null
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
// В метке нет номера задания: модели их выдумывают, а нумерация меняется по годам.
const EXAMS: Record<Exclude<StudyGoal, 'SCHOOL'>, { country: Country; about: string; tag: string }> = {
  OGE: {
    country: 'RU',
    about: 'ОГЭ — экзамен за 9 класс в России',
    tag: '«ОГЭ»',
  },
  EGE: {
    country: 'RU',
    about: 'ЕГЭ — экзамен за 11 класс в России',
    tag: '«ЕГЭ»',
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

/** Пожелания одной строкой: переносы и кавычки-ёлочки не должны ломать рамку вокруг них. */
function wishesLine(raw: string | null | undefined): string | null {
  const wishes = (raw ?? '').replace(/[«»]/g, '"').replace(/\s+/g, ' ').trim().slice(0, WISHES_MAX)
  if (!wishes) return null
  return `Пожелания репетитора к этому материалу: «${wishes}». Выполни их: они важнее общих советов о том, что включить в теорию и в задания, и важнее порядка тем в программе. Не меняются только формат ответа — JSON с теми же полями, число заданий, обращение на «ты» и правила записи формул.`
}

export function buildMessages(input: PromptInput): { role: 'system' | 'user'; content: string }[] {
  const exam = input.goal === 'SCHOOL' ? null : EXAMS[input.goal]
  const subject = canonicalSubject(input.subject)
  const format = examFormat(input.goal, subject)
  const country = exam?.country ?? input.country
  const curriculum = program(country, subject, input.grade, Boolean(exam))
  const book = textbook(country, subject, input.grade, !curriculum)
  const n = input.homeworkCount
  const examTasks = exam
    ? `— Последние ${examTaskCount(n)} задания в homework — в формате экзамена (${exam.about}). ` +
      (format
        ? 'Тип каждого выбери из списка «Формат экзамена», который идёт вместе с темой урока, — тот, что проверяет эту тему; типы не повторяй. Не бери тип, формулировка которого к теме не подходит по смыслу. Формулировка, объём, число вариантов ответа и вид ответа — как в образце, даже если общие правила выше советуют оформить иначе; только обращение оставь на «ты». Если к теме не подходит ни один тип, составь задание в том же стиле. '
        : 'Формулировка и варианты ответа — как на экзамене. ') +
      `В их tag напиши ${exam.tag}. У остальных заданий tag — null.`
    : '— tag у всех заданий — null.'

  // До алгебры (7 класс) буквенная запись правил ученику ещё не знакома
  const ruleStyle =
    input.grade && input.grade <= 6
      ? ' Ученик в младших классах: правила действий записывай словами, без букв вместо чисел («a/b + c/b» ему непонятно). Буквами — только формулы, которые в этом классе учат наизусть: S = a · b, s = v · t.'
      : ''

  const system = [
    'Ты репетитор, которого ученики ценят за то, что после его объяснений всё становится понятно. После урока пишешь ученику конспект и домашнее задание.',
    '',
    'Язык:',
    '— Пиши по-русски, грамотно и коротко. К ученику обращайся только на «ты»: «реши», «найди», «запиши», «напиши». Формы на «вы» («решите», «напишите», «укажите») запрещены везде, включая условия задач.',
    '— Термины — как в школьных учебниках программы ученика, но каждый новый термин сначала объясни простыми словами. Не вставляй английские слова и латинские сокращения, если есть русский термин: «ИЮПАК», «н-бутан», «парабола».',
    '— Проверяй каждое вычисление, формулу и правило: ученик будет учиться по этому тексту.',
    '',
    'Теория:',
    '— Читатель — школьник, который тему не понял или забыл. Объясни её так, как объяснил бы после урока толковый старшеклассник: по-простому, коротко и по делу. Конспект читается за пару минут.',
    '— Сначала скажи мысль своими словами: что это и зачем. Потом покажи, на чём это видно, — пример из жизни или из темы. Объясняй, почему так, а не только что делать. Расчёты с числами — в поле ex и в разборе примера, а не вместо объяснения.',
    '— Только главное: то, без чего тему не понять и задачу не решить. Определения и оговорки из учебника, которые в задачах не понадобятся, не включай. Программа и учебник нужны, чтобы не выйти за пройденное и взять верные термины, а не чтобы пересказывать их формулировки.',
    '— Хотя бы в одном-двух блоках — пример, который ученик видел сам: автобус тормозит, тележка в магазине, сдача в кассе. Он должен объяснять, а не украшать.',
    '— Слова обычные, предложения короткие. Термин оставь, но тут же скажи то же самое по-простому.',
    '— Правило говори так, как сказал бы вслух: «Две стороны и угол между ними равны — значит, равны и треугольники», а не «Достаточно равенства двух сторон и угла между ними».',
    '— Два-четыре однотипных пункта — случаи, шаги, пары «так — не так» — пиши с новой строки каждый, без значков в начале.',
    '— Без смайликов и значков-картинок: в PDF они не печатаются.',
    '— Как это выглядит — в образцах в конце сообщения с темой урока.',
    '',
    'Формулы:',
    '— Только обычный текст с символами Unicode, без LaTeX и без markdown.',
    '— Степени и индексы — надстрочными и подстрочными знаками: x², 10⁻³, x₁, H₂SO₄, CₙH₂ₙ₊₂. Нельзя писать CH4, x^2, x_1.',
    '— Можно: → ↔ ↑ ↓ ° · × ÷ ± ≤ ≥ ≠ ≈ √ ∞ π Δ и греческие буквы. Треугольник можно обозначать знаком △.',
    '— Знаков ⇄ ∠ ⊥ ∥ ∈ ∪ ∩ нет в шрифте, на их месте напечатается пустой квадрат. Пиши словами: «угол A равен углу D», «AB перпендикулярно CD», «пересечение множеств A и B».',
    '',
    'Задания (пример и домашка):',
    '— Каждое задание — строго по теме урока и проверяет именно её.',
    '— В условии не должно быть ответа или подсказки к нему: никаких слов в скобках с правильным вариантом. Ответ — только в поле answer.',
    '— Текст печатается без жирного, курсива и подчёркивания. Не пиши «выделенное слово» или «подчёркнутое»: нужное слово набери ЗАГЛАВНЫМИ буквами прямо в предложении и сошлись на него так: «слово, записанное заглавными буквами».',
    '— В заданиях на пропущенные буквы пиши предложение целиком и без ошибок, а буквы, которые ученик должен вставить, возьми в двойные квадратные скобки: «Мне пора собира[[ть]]ся, а брат ещё умывае[[т]]ся». Пропуски на их месте поставит программа — сам «..» не пиши. В скобках только те буквы, которые проверяет тема урока. Слово должно существовать и стоять в нужной форме: «листья опадают», а не «опадаются». В заданиях на пунктуацию давай предложение целиком без знаков, которые надо расставить.',
    '— У каждого задания один однозначный ответ, который можно проверить.',
    '— Числа в условии согласованы: фигура или ситуация с такими данными должна существовать. Число давай только тем величинам, без которых ответ не найти; всё остальное записывай равенством без чисел: «AB = DE, угол A равен углу D, угол B равен углу E, AC = 7 см. Найди DF». Сторона и два угла или две стороны и угол между ними уже задают треугольник целиком: если дать их числами и добавить ещё одну длину или угол, данные не сойдутся. Это правило — для условий заданий; в теории пример с конкретными числами стоит в поле ex: «AB = 3 см, AC = 4 см, угол A равен 60°», только не приписывай фигуре лишних величин.',
    '— Задания не повторяют друг друга и разобранный пример: в каждом свои данные и свои предложения. Домашка охватывает все случаи, разобранные в теории, а не один из них; формулировки заданий разные.',
    '',
    'Что написать:',
    '— title: название темы для заголовка, до 6 слов, без точки и без скобок.',
    `— theory: от 1 до 4 блоков — столько, сколько в теме отдельных мыслей. Одно правило — один блок: не дроби его на «что это», «когда так» и «когда иначе» и не добавляй блоки ради объёма. Тема из одного правила или одной формулы — 1–2 блока, большая тема — 3–4. Объём: все p вместе — не больше 120 слов; не помещается — выкинь второстепенное, а не сокращай главное. h — заголовок в 2–5 слов, по-человечески: «Сила разгоняет», «Сколько будет корней». p — объяснение: 1–3 коротких предложения или короткий перечень. rule — то, что надо запомнить: формула или правило одной строкой простыми словами, со всеми условиями, без которых им нельзя пользоваться. Запоминать в блоке нечего — null.${ruleStyle} ex — примеры с конкретными данными, от одной до четырёх коротких строк, или null.`,
    '— mistakes: 2–3 типичные ошибки. Лучше всего — заблуждения: что ученик думает неправильно и как на самом деле. Каждая в одну-две короткие фразы.',
    '— example: одна типовая задача и решение по шагам, шаги нумеруй «1) … 2) …».',
    `— homework: ровно ${n} заданий от простого к сложному. task — условие в одно-два предложения с конкретными данными, понятное без пояснений. answer — ответ и решение в одно-два предложения: его увидит только репетитор.`,
    examTasks,
    '',
    'Верни ТОЛЬКО JSON без пояснений и без ```:',
    '{"title":"…","theory":[{"h":"…","p":"…","rule":"…","ex":"…"}],"mistakes":["…"],"example":{"task":"…","solution":"…"},"homework":[{"task":"…","tag":null,"answer":"…"}]}',
  ].join('\n')

  const level = subject === 'Математика' && input.goal === 'EGE' ? 'ЕГЭ, профильный уровень' : GOAL_LABELS[input.goal]
  const user = [
    `Предмет: ${input.subject}.`,
    input.grade ? `Ученик: ${input.grade} класс.` : null,
    `Программа: ${PROGRAMS[country]}.`,
    level ? `Цель: подготовка к экзамену — ${level}.` : 'Цель: школьная программа, экзамена нет.',
    `Тема урока: «${input.topic}».`,
    wishesLine(input.wishes),
    SUBJECT_HINTS[subject] ?? null,
    curriculum ? `\n${curriculum}` : null,
    book ? `\n${book}` : null,
    format ? `\n${format}` : null,
    // Образцы — в конце и в сообщении пользователя: они случайные, а системный промпт должен оставаться одинаковым для кэша
    `\n${styleExemplars(subject, input.topic)}`,
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
const MAX_DOUBT = 300

// Знаки, которых нет в шрифте PDF: без замены на их месте печатается пустой квадрат.
// Промпт их запрещает, но модели ставят всё равно.
const NO_GLYPH: [RegExp, string][] = [
  [/∠\s*/g, 'угол '],
  [/\s*⊥\s*/g, ' перпендикулярно '],
  [/\s*∥\s*/g, ' параллельно '],
  [/\s*∈\s*/g, ' принадлежит '],
]

function text(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== 'string') return null
  const plain = NO_GLYPH.reduce((s, [sign, word]) => s.replace(sign, word), v).trim()
  // Замена могла оказаться в начале предложения: «∠A = 40°. ∠B = …»
  const t = plain.replace(/(^|[.!?]\s+)угол /g, (_, before: string) => `${before}Угол `).slice(0, max)
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
        .map((t) => ({ h: text(t.h), p: text(t.p), rule: text(t.rule), ex: text(t.ex) }))
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
        .map((item) => ({
          task: text(item.task),
          tag: text(item.tag, MAX_TITLE),
          answer: text(item.answer),
          doubt: text(item.doubt, MAX_DOUBT),
        }))
        .filter((item): item is typeof item & { task: string } => Boolean(item.task))
        .slice(0, 12)
    : []

  if (theory.length === 0 || !task || !solution || homework.length === 0) return null
  return {
    title: text(d.title, MAX_TITLE),
    theory,
    mistakes,
    // Шаги «1) … 2) …» модель пишет в одну строку — разносим по строкам.
    // Только после конца предложения: иначе рвётся формула вида «(x + 1) = 3».
    example: {
      task,
      solution: solution.replace(/(?<=[.;:!?])\s+(?=\d+\)\s)/g, '\n'),
      doubt: text(ex.doubt, MAX_DOUBT),
    },
    homework,
    check: CHECK_STATUSES.includes(d.check as string) ? (d.check as CheckStatus) : null,
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
  const content = coerceContent(extractJson(raw))
  // Итог проверки ответов ставит сервер; из ответа модели его не берём
  return content && withoutCheck(applyGaps(content))
}

// Буквы, которые ученик должен вставить, модель берёт в [[…]], а пропуск ставит
// код: когда модель режет слово сама, выходит «встретить..ся» и «стараю..ся».
// Двойные скобки — чтобы не задеть промежутки вида [1; 5].
const GAP = /\[\[([^[\]]{1,12})\]\]/g
const gapped = (s: string) => s.replace(GAP, '..')
const filled = (s: string) => s.replace(GAP, '$1')

/** Ставит пропуски в условиях и убирает разметку из всего, что читает человек. */
function applyGaps(content: MaterialContent): MaterialContent {
  return {
    ...content,
    theory: content.theory.map((t) => ({
      ...t,
      p: filled(t.p),
      rule: t.rule && filled(t.rule),
      ex: t.ex && filled(t.ex),
    })),
    mistakes: content.mistakes.map(filled),
    example: { ...content.example, task: gapped(content.example.task), solution: filled(content.example.solution) },
    homework: content.homework.map((h) => ({
      ...h,
      task: gapped(h.task),
      // Ключа нет — им служит само предложение с буквами на месте
      answer: h.answer ? filled(h.answer) : filled(h.task) !== h.task ? filled(h.task) : null,
    })),
  }
}

/** JSON из ответа модели: всё между первой { и последней }; null — не нашёлся. */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Материал без итогов проверки ответов. */
export function withoutCheck(content: MaterialContent): MaterialContent {
  return {
    ...content,
    check: null,
    example: { ...content.example, doubt: null },
    homework: content.homework.map((h) => ({ ...h, doubt: null })),
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
      { h: 'Зачем это нужно', p: `Что такое «${topic}» и в каких задачах это встречается — простыми словами.`, rule: null, ex: null },
      {
        h: 'Главное правило',
        p: 'Объяснение, почему правило работает и как его запомнить.',
        rule: 'Само правило или формула одной строкой.',
        ex: 'Мини-пример в одну строку.',
      },
      { h: 'Как применять', p: 'По шагам: с чего начать и как себя проверить.', rule: null, ex: null },
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
