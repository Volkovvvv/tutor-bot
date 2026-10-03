/**
 * Сравнение моделей на материалах урока: одни и те же темы прогоняются
 * через несколько моделей, результат — HTML-отчёт для вычитки глазами.
 *
 *   npm run compare-models
 *   npm run compare-models -- google/gemini-2.5-flash openai/gpt-5-mini
 *
 * Ключ и адрес API берутся из .env (AI_API_KEY, AI_BASE_URL), как в AiService.
 * Id моделей — как на https://openrouter.ai/models.
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildMessages, levelLabel, type MaterialContent, parseContent, type PromptInput } from '../src/materials/material-content'

const DEFAULT_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'deepseek/deepseek-chat',
  'google/gemini-2.5-flash',
  'openai/gpt-5-mini',
  'anthropic/claude-haiku-4.5',
]

// Темы, на которых модели чаще всего ошибаются: орфография, расчёты,
// уравнения реакций, генетика.
const CASES: PromptInput[] = [
  { subject: 'Русский язык', topic: 'Н и НН в суффиксах прилагательных и причастий', grade: 8, goal: 'OGE', country: 'RU', homeworkCount: 6 },
  { subject: 'Русский язык', topic: 'Запятые при причастном и деепричастном оборотах', grade: 7, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  { subject: 'Математика', topic: 'Квадратные уравнения, теорема Виета', grade: 8, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  { subject: 'Математика', topic: 'Логарифмы и их свойства', grade: 11, goal: 'EGE', country: 'RU', homeworkCount: 6 },
  { subject: 'Физика', topic: 'Закон Ома для участка цепи, последовательное и параллельное соединение', grade: 8, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  { subject: 'Физика', topic: 'Закон сохранения импульса', grade: 10, goal: 'EGE', country: 'RU', homeworkCount: 6 },
  { subject: 'Химия', topic: 'Окислительно-восстановительные реакции, метод электронного баланса', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
  { subject: 'Химия', topic: 'Расчёты по уравнению реакции: количество вещества и масса', grade: 8, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  { subject: 'Биология', topic: 'Моногибридное скрещивание, законы Менделя', grade: 10, goal: 'EGE', country: 'RU', homeworkCount: 6 },
  { subject: 'Биология', topic: 'Митоз и мейоз', grade: 9, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  { subject: 'Английский', topic: 'Present Perfect vs Past Simple', grade: 7, goal: 'SCHOOL', country: 'RU', homeworkCount: 6 },
  { subject: 'Английский', topic: 'Conditionals: zero, first, second', grade: 9, goal: 'OGE', country: 'RU', homeworkCount: 6 },
]

const CONCURRENCY = 4
const TIMEOUT_MS = 120_000

interface Result {
  model: string
  input: PromptInput
  ms: number
  content: MaterialContent | null
  raw: string | null
  error: string | null
  tokensOut: number | null
  /** Стоимость в $, если провайдер её вернул (OpenRouter возвращает). */
  cost: number | null
}

async function run(model: string, input: PromptInput): Promise<Result> {
  const apiKey = process.env.AI_API_KEY
  const baseUrl = (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  const started = Date.now()
  const base = { model, input, content: null, raw: null, error: null, tokensOut: null, cost: null }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, 'x-title': 'Tutor CRM' },
      body: JSON.stringify({
        model,
        messages: buildMessages(input),
        temperature: 0.4,
        max_tokens: 8000,
        reasoning: { max_tokens: 2000 },
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const ms = Date.now() - started
    if (!res.ok) {
      return { ...base, ms, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { completion_tokens?: number; cost?: number }
    }
    const raw = data.choices?.[0]?.message?.content ?? null
    const content = raw ? parseContent(raw) : null
    return {
      ...base,
      ms,
      raw,
      content,
      error: content ? null : 'ответ не разобран как JSON',
      tokensOut: data.usage?.completion_tokens ?? null,
      cost: data.usage?.cost ?? null,
    }
  } catch (e) {
    return { ...base, ms: Date.now() - started, error: (e as Error).message }
  }
}

/** Выполняет задачи не больше чем по `limit` одновременно. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number, onDone: () => void): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
      onDone()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function renderCell(r: Result): string {
  const meta = [
    `${(r.ms / 1000).toFixed(1)} с`,
    r.tokensOut != null ? `${r.tokensOut} ток.` : null,
    r.cost != null ? `$${r.cost.toFixed(4)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (!r.content) {
    return `<div class="meta">${meta}</div><div class="err">${esc(r.error ?? '')}</div>` +
      (r.raw ? `<details><summary>сырой ответ</summary><pre>${esc(r.raw)}</pre></details>` : '')
  }
  const c = r.content
  return `<div class="meta">${meta}</div>
    <h4>${esc(c.title ?? '—')}</h4>
    <h4>Теория</h4>${c.theory.map((t) => `<p><b>${esc(t.h)}.</b> ${esc(t.p)}${t.ex ? `<br><i>${esc(t.ex)}</i>` : ''}</p>`).join('')}
    <h4>Ошибки</h4><ul>${c.mistakes.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    <h4>Пример</h4><p>${esc(c.example.task)}</p><pre>${esc(c.example.solution)}</pre>
    <h4>Домашка</h4><ol>${c.homework.map((h) => `<li>${h.tag ? `<b>[${esc(h.tag)}]</b> ` : ''}${esc(h.task)}<br><small>Ответ: ${esc(h.answer ?? '—')}</small></li>`).join('')}</ol>
    <label class="mark"><input type="checkbox"> есть ошибка</label>`
}

function renderReport(models: string[], results: Result[]): string {
  const byKey = new Map(results.map((r) => [`${r.model}|${r.input.topic}`, r]))

  const summary = models
    .map((m) => {
      const rs = results.filter((r) => r.model === m)
      const ok = rs.filter((r) => r.content)
      const avg = ok.length ? ok.reduce((s, r) => s + r.ms, 0) / ok.length / 1000 : 0
      const costs = rs.map((r) => r.cost).filter((c): c is number => c != null)
      const cost = costs.length ? `$${(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(4)}` : '—'
      return `<tr><td>${esc(m)}</td><td>${ok.length}/${rs.length}</td><td>${avg.toFixed(1)} с</td><td>${cost}</td></tr>`
    })
    .join('')

  const rows = CASES.map((input) => {
    const cells = models.map((m) => `<td>${renderCell(byKey.get(`${m}|${input.topic}`)!)}</td>`).join('')
    return `<tr><th class="case">${esc(input.subject)}<br><small>${esc(input.topic)}<br>${esc(levelLabel(input.grade, input.goal) ?? '')}</small></th>${cells}</tr>`
  }).join('')

  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Сравнение моделей</title>
<style>
  body { font: 14px/1.45 system-ui, sans-serif; margin: 16px; color: #1d1d1f; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #ddd; padding: 8px 10px; vertical-align: top; text-align: left; }
  .grid td { min-width: 340px; max-width: 420px; }
  .grid thead th { position: sticky; top: 0; background: #f4f2fb; z-index: 1; }
  th.case { position: sticky; left: 0; background: #fafafa; min-width: 160px; max-width: 180px; }
  h4 { margin: 10px 0 4px; font-size: 12px; text-transform: uppercase; color: #777; }
  p { margin: 4px 0; }
  pre { white-space: pre-wrap; font: inherit; background: #f7f7f7; padding: 6px; margin: 4px 0; }
  ol { margin: 4px 0; padding-left: 20px; }
  .meta { font-size: 12px; color: #888; }
  .err { color: #c0392b; }
  .mark { display: block; margin-top: 8px; font-size: 12px; color: #c0392b; }
  td:has(.mark input:checked) { background: #fdecea; }
</style>
<h2>Сводка</h2>
<table><tr><th>Модель</th><th>Разобрано</th><th>Среднее время</th><th>Средняя цена</th></tr>${summary}</table>
<h2>Материалы</h2>
<table class="grid"><thead><tr><th class="case">Тема</th>${models.map((m) => `<th>${esc(m)}</th>`).join('')}</tr></thead>
<tbody>${rows}</tbody></table>
</html>`
}

async function main() {
  if (!process.env.AI_API_KEY) {
    console.error('Задайте AI_API_KEY в api/.env')
    process.exit(1)
  }
  const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS
  const tasks = models.flatMap((m) => CASES.map((c) => () => run(m, c)))

  let done = 0
  const results = await pool(tasks, CONCURRENCY, () => {
    process.stdout.write(`\r${++done}/${tasks.length}`)
  })
  process.stdout.write('\n')

  for (const r of results.filter((r) => r.error)) {
    console.warn(`${r.model} · ${r.input.topic}: ${r.error!.slice(0, 120)}`)
  }

  const out = resolve(__dirname, '../model-compare.html')
  writeFileSync(out, renderReport(models, results))
  console.log(`Отчёт: ${out}`)
}

main()
