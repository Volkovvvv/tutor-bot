/**
 * Стенд качества: модели пишут материалы по одним и тем же темам,
 * модель-проверяющий вслепую решает задания и ищет ошибки.
 *
 *   npm run eval-models -- gen      # генерация (пропускает уже готовое)
 *   npm run eval-models -- judge    # проверка (пропускает уже проверенное)
 *   npm run eval-models -- report   # таблица в консоль и HTML-отчёт
 *
 * Запускать через `caffeinate -i`: если ноутбук уснёт, запросы оборвутся,
 * а OpenRouter всё равно спишет за них деньги.
 *
 * Результаты копятся в eval-out/results.json: повторный запуск доделывает
 * недостающее и не платит дважды. Потолок расходов — EVAL_BUDGET_USD.
 *
 * Сравнить две версии промпта на одной модели:
 *   EVAL_SET=exam EVAL_ONLY=openai/gpt-6-luna EVAL_LABEL=до npm run eval-models -- gen
 *   …правим промпт…
 *   EVAL_SET=exam EVAL_ONLY=openai/gpt-6-luna EVAL_LABEL=после npm run eval-models -- gen
 * EVAL_SET — свой набор тем и свой файл результатов, EVAL_LABEL — пометка
 * версии: в отчёте «модель@пометка» идёт отдельной строкой.
 */
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMessages, levelLabel, type MaterialContent, parseContent, type PromptInput } from '../src/materials/material-content'

const MODELS = [
  'openai/gpt-6-luna',
  'deepseek/deepseek-v4-pro',
  'google/gemini-3.8-flash',
  'x-ai/grok-4.7',
  'openai/gpt-6.1-sol',
  'anthropic/claude-sonnet-5.5',
  // Второй круг: дешёвые модели
  'openai/gpt-6-luna-pro',
  'x-ai/grok-4.3',
  'z-ai/glm-5.3',
  'deepseek/deepseek-v4.1-flash',
  // Текущая модель прода — для сравнения. Последней: её провайдер
  // временами зависает и не должен задерживать остальных.
  'nvidia/nemotron-3-super-120b-a12b',
]
// EVAL_ONLY="a/b,c/d" — прогнать только часть моделей; отчёт всё равно по всем
const ONLY = process.env.EVAL_ONLY?.split(',').map((s) => s.trim())
const JUDGE = 'anthropic/claude-sonnet-5.5'
const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? 3.5)

const LABEL = process.env.EVAL_LABEL?.trim()
// Сколько раз собрать каждую тему: один прогон слишком шумный, чтобы сравнивать версии промпта.
// Повторы идут отдельными строками «модель@пометка·1», «…·2».
// Уровень рассуждений при генерации — как AI_REASONING_EFFORT на сервере
const EFFORT = process.env.EVAL_EFFORT?.trim() || 'high'
const RUNS = Math.max(1, Math.floor(Number(process.env.EVAL_RUNS ?? 1)) || 1)
const SET = process.env.EVAL_SET?.trim() || 'main'

/** ahead — слова из тем следующих классов: в материале их быть не должно. */
type Case = PromptInput & { ahead?: string[] }

const CASE_SETS: Record<string, Case[]> = {
  // По одной теме на предмет; цели разные, чтобы проверить формат экзаменов.
  main: [
    { subject: 'Русский язык', topic: 'Деепричастный оборот', grade: 7, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Логарифмические уравнения', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Физика', topic: 'Закон Ома, последовательное и параллельное соединение', grade: 8, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Химия', topic: 'Алканы: номенклатура, изомерия, химические свойства', grade: 11, goal: 'CE', country: 'BY', homeworkCount: 6 },
    { subject: 'Английский', topic: 'Present Perfect vs Past Simple', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Биология', topic: 'Моногибридное скрещивание, законы Менделя', grade: 10, goal: 'EGE', country: 'RU', homeworkCount: 6 },
  ],
  // Предметы, для которых есть карточка формата экзамена
  exam: [
    { subject: 'Математика', topic: 'Квадратные и дробно-рациональные неравенства', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Арифметическая и геометрическая прогрессии', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Трапеция: средняя линия, площадь', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Н и НН в прилагательных и причастиях', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Знаки препинания в сложноподчинённом предложении', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Паронимы и лексические нормы', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Логарифмические уравнения', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Физика', topic: 'Конденсаторы: ёмкость, заряд, энергия', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Химия', topic: 'Гидролиз солей', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Биология', topic: 'Митоз и мейоз', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Английский', topic: 'Словообразование: суффиксы и отрицательные приставки', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Обособленные определения и обстоятельства', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Физика', topic: 'Архимедова сила, плавание тел', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Химия', topic: 'Реакции ионного обмена', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Биология', topic: 'Кровеносная система человека', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Английский', topic: 'Passive Voice', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
  ],
  // Классы, для которых есть карточка учебной программы
  program: [
    { subject: 'Математика', topic: 'Сложение и вычитание обыкновенных дробей', grade: 5, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Формулы сокращённого умножения', grade: 7, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Теорема Виета', grade: 8, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Арифметическая прогрессия', grade: 9, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Тригонометрические уравнения', grade: 10, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Логарифмические уравнения', grade: 11, goal: 'CE', country: 'BY', homeworkCount: 6 },
  ],
  // Не забегает ли модель вперёд: 7–8 классы, в ahead — слова из следующих классов
  ahead: [
    { subject: 'Математика', topic: 'Линейные уравнения с одной переменной', grade: 7, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['дискриминант', '√', 'квадратный корень', 'квадратное уравнение', 'парабол'] },
    { subject: 'Математика', topic: 'Разложение многочлена на множители', grade: 7, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['дискриминант', '√', 'квадратный корень', 'виет', 'куб суммы', 'сумма кубов'] },
    { subject: 'Математика', topic: 'Свойства равнобедренного треугольника', grade: 7, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['пифагор', '√', 'синус', 'косинус', 'подобн', 'средняя линия'] },
    { subject: 'Математика', topic: 'Сумма углов треугольника, внешний угол', grade: 7, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['пифагор', '√', 'синус', 'косинус', 'подобн', 'вписанн'] },
    { subject: 'Математика', topic: 'Теорема Пифагора', grade: 8, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['синус', 'косинус', 'тангенс', 'теорема косинусов'] },
    { subject: 'Математика', topic: 'Квадратные уравнения, дискриминант', grade: 8, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['рациональная дробь', 'дробно-рациональн', 'метод интервалов', 'прогресси'] },
  ],
  // Быстрый взгляд на карточки программы: по одной теме на 6, 7 и 8 классы
  sample: [
    { subject: 'Математика', topic: 'Пропорция и её свойства', grade: 6, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['отрицательн', 'модуль', 'линейное уравнение', 'функци'] },
    { subject: 'Математика', topic: 'Признаки равенства треугольников', grade: 7, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['пифагор', '√', 'синус', 'косинус', 'подобн', 'накрест лежащ', 'сумма углов'] },
    { subject: 'Математика', topic: 'Квадратные уравнения, дискриминант', grade: 8, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, ahead: ['рациональная дробь', 'дробно-рациональн', 'метод интервалов', 'парабол'] },
    // Та же тема с пожеланиями репетитора
    { subject: 'Математика', topic: 'Квадратные уравнения', grade: 8, goal: 'SCHOOL', country: 'BY', homeworkCount: 6, wishes: 'В теории разбери неполные уравнения. В домашке два неполных уравнения и одна текстовая задача про площадь прямоугольника.' },
  ],
  // Русский язык: темы, где модели ошибаются чаще всего — правила с исключениями
  // и особыми формами, спорные нормы, пунктуация с вариантами. Последние две — для контроля.
  ru: [
    { subject: 'Русский язык', topic: 'Н и НН в прилагательных', grade: null, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Н и НН в причастиях и отглагольных прилагательных', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Деепричастный оборот', grade: 7, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Причастный оборот', grade: 7, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'НЕ с прилагательными', grade: 6, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Приставки ПРЕ- и ПРИ-', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Вводные слова', grade: 8, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Тире между подлежащим и сказуемым', grade: 8, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: 'Чередование гласных в корнях -лаг-/-лож- и -раст-/-ращ-/-рос-', grade: 6, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
    { subject: 'Русский язык', topic: '-тся и -ться в глаголах', grade: 5, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  ],
  // Класс и предмет, для которых есть карточка учебника
  textbook: [
    { subject: 'Математика', topic: 'Сложение чисел с разными знаками', grade: 6, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Основные задачи на проценты', grade: 6, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
    { subject: 'Математика', topic: 'Деление на десятичную дробь', grade: 6, goal: 'SCHOOL', country: 'BY', homeworkCount: 6 },
  ],
}
const CASES = CASE_SETS[SET] ?? []

interface Verdict {
  theory_errors: string[]
  example_ok: boolean
  tasks: { n: number; verdict: 'ok' | 'wrong_answer' | 'bad_task'; note: string }[]
  language_issues: string[]
  tone: number
  exam_format: number | null
  overall: number
  comment: string
}

interface Entry {
  model: string
  topic: string
  ms: number
  cost: number
  content: MaterialContent | null
  error: string | null
  verdict?: Verdict | null
  judgeCost?: number
}

const OUT_DIR = resolve(__dirname, '../eval-out')
const SUFFIX = SET === 'main' ? '' : `-${SET}`
const RESULTS = resolve(OUT_DIR, `results${SUFFIX}.json`)
const CONCURRENCY = 4

const load = (): Entry[] => (existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, 'utf8')) : [])
const save = (entries: Entry[]) => {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(RESULTS, JSON.stringify(entries, null, 1))
}
const spent = (entries: Entry[]) => entries.reduce((s, e) => s + e.cost + (e.judgeCost ?? 0), 0)

/**
 * Потоковый запрос. Обычный держит соединение молчащим, пока модель думает,
 * и на длинных ответах оно обрывается по пути; поток идёт непрерывно.
 */
async function chat(
  model: string,
  messages: { role: string; content: string }[],
  // Как модель рассуждает и сколько токенов ей дать на ответ
  reasoning: Record<string, unknown>,
  maxTokens = 8000,
): Promise<{ text: string | null; cost: number; ms: number; error: string | null }> {
  const started = Date.now()
  let text = ''
  let cost = 0
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.AI_API_KEY}`, 'x-title': 'Tutor CRM eval' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: maxTokens,
        reasoning,
        usage: { include: true },
        stream: true,
      }),
      signal: AbortSignal.timeout(300_000),
    })
    if (!res.ok || !res.body) {
      return { text: null, cost: 0, ms: Date.now() - started, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` }
    }

    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const data = JSON.parse(line.slice(6)) as {
            choices?: { delta?: { content?: string } }[]
            usage?: { cost?: number }
            error?: { message?: string }
          }
          if (data.error) return { text: null, cost, ms: Date.now() - started, error: data.error.message ?? 'ошибка провайдера' }
          text += data.choices?.[0]?.delta?.content ?? ''
          if (data.usage?.cost != null) cost = data.usage.cost
        } catch {
          // служебная строка потока — не JSON
        }
      }
    }
    return { text: text || null, cost, ms: Date.now() - started, error: null }
  } catch (e) {
    return { text: null, cost, ms: Date.now() - started, error: (e as Error).message }
  }
}

/** Задачи по `CONCURRENCY` штук; останавливается, когда кончился бюджет. */
async function pool(tasks: (() => Promise<void>)[], entries: Entry[]): Promise<void> {
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < tasks.length) {
      if (spent(entries) >= BUDGET_USD) {
        console.warn(`\nБюджет $${BUDGET_USD} исчерпан — остановка`)
        return
      }
      await tasks[next++]()
      save(entries)
      process.stdout.write(`\r${++done}/${tasks.length} · потрачено $${spent(entries).toFixed(3)}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker))
  process.stdout.write('\n')
}

async function gen(entries: Entry[]): Promise<void> {
  const tasks = MODELS.filter((m) => !ONLY || ONLY.includes(m)).flatMap((apiModel) =>
    Array.from({ length: RUNS }, (_, run) => run).flatMap((run) => {
    const base = LABEL ? `${apiModel}@${LABEL}` : apiModel
    const model = RUNS > 1 ? `${base}·${run + 1}` : base
    return CASES.filter((c) => !entries.some((e) => e.model === model && e.topic === c.topic && e.content)).map((input) => async () => {
      // Две попытки — как в AiService
      let last: Entry = { model, topic: input.topic, ms: 0, cost: 0, content: null, error: 'не запускалась' }
      for (let attempt = 0; attempt < 2 && !last.content; attempt++) {
        // Те же настройки, что в AiService: иначе стенд меряет не то, что получит репетитор
        const r = await chat(apiModel, buildMessages(input), { effort: EFFORT }, 16000)
        const content = r.text ? parseContent(r.text) : null
        last = {
          model,
          topic: input.topic,
          ms: last.ms + r.ms,
          cost: last.cost + r.cost,
          content,
          error: content ? null : (r.error ?? 'ответ не разобран как JSON'),
        }
      }
      const i = entries.findIndex((e) => e.model === model && e.topic === input.topic)
      if (i === -1) entries.push(last)
      else entries[i] = last
    })
  }))
  await pool(tasks, entries)
}

const JUDGE_SYSTEM = [
  'Ты строгий эксперт-предметник и методист. Проверяешь материал для школьника, написанный ИИ: конспект, разбор примера и домашнее задание с ответами для репетитора.',
  'По этому тексту ученик будет учиться, поэтому любая фактическая ошибка недопустима. Не будь снисходительным.',
  '',
  'Что сделать:',
  '1. Теория, типичные ошибки и разбор примера: найди фактические ошибки (неверное правило, формула, вычисление, неверный пример). Отдельно проверь: не сформулировано ли правило шире, чем оно верно («всегда», «любой», «столько же», когда есть исключения или особые формы); не противоречит ли пример своему правилу; не подана ли спорная или двоякая норма как однозначная. Стиль сюда не относится.',
  '2. Каждое задание домашки реши самостоятельно, затем сравни с ответом автора. Вердикт:',
  '   ok — задание корректно и ответ верный;',
  '   wrong_answer — задание корректно, но ответ автора неверный или неполный по сути;',
  '   bad_task — само задание негодное: некорректное условие, нет однозначного ответа, не по теме, ответ подсказан в условии, не решается по данным.',
  '3. Язык: перечисли конкретные проблемы — иностранные слова в русском тексте, обращение на «вы» вместо «ты», грамматические ошибки, формулы не в Unicode (x^2, CH4).',
  '4. tone (1–5): насколько объяснение понятно ученику. 5 — живо, от примера к правилу, без учебничного тона; 1 — сухая выжимка из учебника.',
  '5. exam_format (1–5 или null): насколько задания с меткой экзамена похожи на реальные задания этого экзамена. null — если цели-экзамена нет.',
  '6. overall (1–10): отправил бы репетитор это ученику без правок? 10 — да, как есть; 5 — после заметной правки; 1 — нет.',
  '',
  'Верни ТОЛЬКО JSON без пояснений и без ```:',
  '{"theory_errors":["…"],"example_ok":true,"tasks":[{"n":1,"verdict":"ok","note":"коротко, в чём проблема, или пусто"}],"language_issues":["…"],"tone":3,"exam_format":null,"overall":6,"comment":"одно предложение — главный вывод"}',
].join('\n')

function parseVerdict(raw: string): Verdict | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const v = JSON.parse(raw.slice(start, end + 1)) as Verdict
    return Array.isArray(v.tasks) && typeof v.overall === 'number' ? v : null
  } catch {
    return null
  }
}

async function judge(entries: Entry[]): Promise<void> {
  const tasks = entries
    .filter((e) => e.content && !e.verdict)
    .map((e) => async () => {
      const input = CASES.find((c) => c.topic === e.topic)!
      // Проверяющий не знает, какая модель автор
      const user = [
        `Предмет: ${input.subject}. Ученик: ${levelLabel(input.grade, input.goal) ?? 'класс не указан'}. Страна: ${input.country === 'BY' ? 'Беларусь' : 'Россия'}.`,
        `Тема урока: «${input.topic}».`,
        '',
        'Материал:',
        JSON.stringify(e.content, null, 1),
      ].join('\n')
      const r = await chat(JUDGE, [{ role: 'system', content: JUDGE_SYSTEM }, { role: 'user', content: user }], { max_tokens: 2000 })
      e.judgeCost = (e.judgeCost ?? 0) + r.cost
      e.verdict = r.text ? parseVerdict(r.text) : null
    })
  await pool(tasks, entries)
}

/** Слова из следующих классов, которые попали в материал. Проверяющий для этого не нужен. */
function aheadHits(e: Entry): string[] | null {
  const words = CASES.find((c) => c.topic === e.topic)?.ahead
  if (!words || !e.content) return null
  const text = JSON.stringify(e.content).toLowerCase()
  return words.filter((w) => text.includes(w))
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function stats(entries: Entry[], model: string) {
  const all = entries.filter((e) => e.model === model)
  const judged = all.filter((e) => e.verdict)
  const tasks = judged.flatMap((e) => e.verdict!.tasks)
  const ahead = all.map(aheadHits).filter((h): h is string[] => h !== null)
  const share = (v: string) => (tasks.length ? (100 * tasks.filter((t) => t.verdict === v).length) / tasks.length : NaN)
  return {
    model,
    generated: `${all.filter((e) => e.content).length}/${CASES.length}`,
    tasksOk: share('ok'),
    wrong: share('wrong_answer'),
    bad: share('bad_task'),
    theoryErrors: avg(judged.map((e) => e.verdict!.theory_errors.length)),
    language: avg(judged.map((e) => e.verdict!.language_issues.length)),
    tone: avg(judged.map((e) => e.verdict!.tone)),
    exam: avg(judged.map((e) => e.verdict!.exam_format).filter((x): x is number => typeof x === 'number')),
    overall: avg(judged.map((e) => e.verdict!.overall)),
    // Доля материалов, где нашлось хотя бы одно слово из следующих классов
    ahead: ahead.length ? (100 * ahead.filter((h) => h.length).length) / ahead.length : NaN,
    cost: avg(all.filter((e) => e.content).map((e) => e.cost)),
    sec: avg(all.filter((e) => e.content).map((e) => e.ms / 1000)),
  }
}

function report(entries: Entry[]): void {
  // Строки — по тому, что есть в результатах: «модель@пометка» в MODELS нет
  const models = [...new Set([...MODELS, ...entries.map((e) => e.model)])].filter((m) => entries.some((e) => e.model === m))
  const rows = models.map((m) => stats(entries, m)).sort((a, b) => (b.overall || 0) - (a.overall || 0))
  const f = (x: number, d = 1) => (Number.isNaN(x) ? '—' : x.toFixed(d))

  console.log('\nМодель                               ген  верно%  неверн%  негодн%  ош.теор  язык  тон  экз  итог  вперёд%  $/мат    сек')
  for (const r of rows) {
    console.log(
      `${r.model.padEnd(36)} ${r.generated.padEnd(4)} ${f(r.tasksOk, 0).padStart(6)} ${f(r.wrong, 0).padStart(8)} ${f(r.bad, 0).padStart(8)} ${f(r.theoryErrors).padStart(8)} ${f(r.language).padStart(5)} ${f(r.tone).padStart(4)} ${f(r.exam).padStart(4)} ${f(r.overall).padStart(5)} ${f(r.ahead, 0).padStart(8)} ${f(r.cost, 4).padStart(7)} ${f(r.sec, 0).padStart(5)}`,
    )
  }
  console.log(`\nПотрачено всего: $${spent(entries).toFixed(3)} (генерация $${entries.reduce((s, e) => s + e.cost, 0).toFixed(3)}, проверка $${entries.reduce((s, e) => s + (e.judgeCost ?? 0), 0).toFixed(3)})`)

  const cell = (e: Entry | undefined): string => {
    if (!e?.content) return `<div class="err">${esc(e?.error ?? 'нет данных')}</div>`
    const c = e.content
    const v = e.verdict
    const mark = (n: number) => v?.tasks.find((t) => t.n === n)
    const hits = aheadHits(e)
    return `<div class="meta">${(e.ms / 1000).toFixed(0)} с · $${e.cost.toFixed(4)}${v ? ` · итог ${v.overall}/10 · тон ${v.tone}/5` : ''}</div>
      ${v ? `<p class="verdict">${esc(v.comment)}</p>` : ''}
      ${hits?.length ? `<div class="bad">Забегает вперёд: ${hits.map(esc).join(', ')}</div>` : ''}
      <h4>${esc(c.title ?? '—')}</h4>
      ${c.theory.map((t) => `<p><b>${esc(t.h)}.</b> ${esc(t.p)}${t.rule ? `<br><b>${esc(t.rule)}</b>` : ''}${t.ex ? `<br><i>${esc(t.ex)}</i>` : ''}</p>`).join('')}
      <h4>Ошибки</h4><ul>${c.mistakes.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <h4>Пример</h4><p>${esc(c.example.task)}</p><pre>${esc(c.example.solution)}</pre>
      ${v?.theory_errors.length ? `<div class="bad">Ошибки в теории: ${v.theory_errors.map(esc).join('; ')}</div>` : ''}
      <h4>Домашка</h4><ol>${c.homework
        .map((h, i) => {
          const m = mark(i + 1)
          const cls = m && m.verdict !== 'ok' ? ' class="bad"' : ''
          return `<li${cls}>${h.tag ? `<b>[${esc(h.tag)}]</b> ` : ''}${esc(h.task)}<br><small>Ответ: ${esc(h.answer ?? '—')}</small>${m && m.verdict !== 'ok' ? `<br><small>⚠ ${m.verdict}: ${esc(m.note)}</small>` : ''}</li>`
        })
        .join('')}</ol>
      ${v?.language_issues.length ? `<div class="warn">Язык: ${v.language_issues.map(esc).join('; ')}</div>` : ''}`
  }

  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Стенд качества</title>
<style>
  body { font: 14px/1.45 system-ui, sans-serif; margin: 16px; color: #1d1d1f; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #ddd; padding: 8px 10px; vertical-align: top; text-align: left; }
  .grid td { min-width: 360px; max-width: 440px; }
  .grid thead th { position: sticky; top: 0; background: #f4f2fb; z-index: 1; }
  th.case { position: sticky; left: 0; background: #fafafa; min-width: 150px; max-width: 170px; }
  h4 { margin: 10px 0 4px; font-size: 12px; text-transform: uppercase; color: #777; }
  p { margin: 4px 0; } pre { white-space: pre-wrap; font: inherit; background: #f7f7f7; padding: 6px; margin: 4px 0; }
  ol, ul { margin: 4px 0; padding-left: 20px; }
  .meta { font-size: 12px; color: #888; } .err { color: #c0392b; }
  .verdict { font-style: italic; color: #555; }
  .bad { background: #fdecea; } .warn { background: #fff6dd; padding: 4px 6px; margin-top: 6px; font-size: 13px; }
  div.bad { padding: 4px 6px; margin-top: 6px; font-size: 13px; }
</style>
<h2>Сводка</h2>
<table><tr><th>Модель</th><th>Собрано</th><th>Заданий верно</th><th>Неверный ответ</th><th>Негодное задание</th><th>Ошибок в теории</th><th>Проблем языка</th><th>Тон /5</th><th>Экзамен /5</th><th>Итог /10</th><th>Забегает вперёд</th><th>$ за материал</th><th>Секунд</th></tr>
${rows.map((r) => `<tr><td>${esc(r.model)}</td><td>${r.generated}</td><td>${f(r.tasksOk, 0)}%</td><td>${f(r.wrong, 0)}%</td><td>${f(r.bad, 0)}%</td><td>${f(r.theoryErrors)}</td><td>${f(r.language)}</td><td>${f(r.tone)}</td><td>${f(r.exam)}</td><td><b>${f(r.overall)}</b></td><td>${Number.isNaN(r.ahead) ? '—' : `${f(r.ahead, 0)}%`}</td><td>${f(r.cost, 4)}</td><td>${f(r.sec, 0)}</td></tr>`).join('')}
</table>
<p>Проверяющий: ${esc(JUDGE)}, вслепую. Красным — задания и теория, где он нашёл ошибку.</p>
<h2>Материалы</h2>
<table class="grid"><thead><tr><th class="case">Тема</th>${rows.map((r) => `<th>${esc(r.model)}</th>`).join('')}</tr></thead>
<tbody>${CASES.map((c) => `<tr><th class="case">${esc(c.subject)}<br><small>${esc(c.topic)}<br>${esc(levelLabel(c.grade, c.goal) ?? '')}</small></th>${rows.map((r) => `<td>${cell(entries.find((e) => e.model === r.model && e.topic === c.topic))}</td>`).join('')}</tr>`).join('')}</tbody></table>
</html>`
  const out = resolve(OUT_DIR, `report${SUFFIX}.html`)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(out, html)
  console.log(`Отчёт: ${out}`)
}

async function main() {
  if (!process.env.AI_API_KEY) {
    console.error('Задайте AI_API_KEY в api/.env')
    process.exit(1)
  }
  if (CASES.length === 0) {
    console.error(`Нет набора тем «${SET}»: ${Object.keys(CASE_SETS).join(' | ')}`)
    process.exit(1)
  }
  const entries = load()
  const step = process.argv[2]
  if (step === 'gen') await gen(entries)
  else if (step === 'judge') await judge(entries)
  else if (step !== 'report') {
    console.error('Шаг: gen | judge | report')
    process.exit(1)
  }
  save(entries)
  report(entries)
}

main()
