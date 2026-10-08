/**
 * Сводка пилота из журнала событий. Без Nest и базы — чтобы проверять тестами.
 */

export interface StatEvent {
  tutorId: string
  name: string
  props: Record<string, unknown>
  createdAt: Date
}

export interface StatsInput {
  events: StatEvent[]
  tutors: number
  seen24h: number
  seen7d: number
}

/** Доля правок, начиная с которой материал считается «сильно переписанным». */
export const STRONG_EDIT = 0.3

export interface StatsSummary {
  tutors: number
  seen24h: number
  seen7d: number
  /** Репетиторы, собравшие хотя бы один материал. */
  generators: number
  generated: number
  regenerated: number
  /** Собирали материалы минимум в два разных дня. */
  returners: number
  medianMs: number | null
  rated: { up: number; down: number; reasons: Record<string, number> }
  edited: { materials: number; strong: number }
  deleted: number
  checked: { total: number; withDoubts: number }
  downloaded: number
  sent: number
  /** Материалы, которые хоть раз скачали или отправили. */
  usedMaterials: number
  forwarded: { yes: number; no: number }
  limitHit: number
  upgradeInterest: number
  retention: { very: number; little: number; no: number }
  imports: { recognized: number; failed: number; series: number }
}

const count = (events: StatEvent[], name: string) => events.filter((e) => e.name === name)
const tutorsOf = (events: StatEvent[]) => new Set(events.map((e) => e.tutorId)).size
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function buildStats(input: StatsInput): StatsSummary {
  const { events } = input
  const generated = count(events, 'material_generated')
  const rating = count(events, 'material_rating')
  const edited = count(events, 'material_edited')
  const checked = count(events, 'material_checked')
  const files = [...count(events, 'pdf_downloaded'), ...count(events, 'pdf_sent')]
  const forwarded = count(events, 'material_forwarded')
  const retention = count(events, 'retention_answer')

  // День — в UTC: для «заходил в два разных дня» сдвиг на часы не важен
  const daysByTutor = new Map<string, Set<string>>()
  for (const e of generated) {
    const days = daysByTutor.get(e.tutorId) ?? new Set<string>()
    days.add(e.createdAt.toISOString().slice(0, 10))
    daysByTutor.set(e.tutorId, days)
  }

  const reasons: Record<string, number> = {}
  for (const e of rating) {
    if (e.props.good !== true && typeof e.props.reason === 'string') {
      reasons[e.props.reason] = (reasons[e.props.reason] ?? 0) + 1
    }
  }

  // Правок по одному материалу может быть много — берём самую большую долю
  const maxShare = new Map<string, number>()
  for (const e of edited) {
    const key = typeof e.props.lessonId === 'string' ? e.props.lessonId : e.createdAt.toISOString()
    maxShare.set(key, Math.max(maxShare.get(key) ?? 0, num(e.props.share) ?? 0))
  }

  return {
    tutors: input.tutors,
    seen24h: input.seen24h,
    seen7d: input.seen7d,
    generators: tutorsOf(generated),
    generated: generated.length,
    regenerated: count(events, 'material_regenerated').length,
    returners: [...daysByTutor.values()].filter((d) => d.size >= 2).length,
    medianMs: median(generated.map((e) => num(e.props.ms)).filter((v): v is number => v !== null)),
    rated: {
      up: rating.filter((e) => e.props.good === true).length,
      down: rating.filter((e) => e.props.good !== true).length,
      reasons,
    },
    edited: {
      materials: maxShare.size,
      strong: [...maxShare.values()].filter((s) => s >= STRONG_EDIT).length,
    },
    deleted: count(events, 'material_deleted').length,
    checked: {
      total: checked.length,
      withDoubts: checked.filter((e) => (num(e.props.answerDoubts) ?? 0) + (num(e.props.theoryDoubts) ?? 0) > 0).length,
    },
    downloaded: count(events, 'pdf_downloaded').length,
    sent: count(events, 'pdf_sent').length,
    usedMaterials: new Set(files.map((e) => e.props.lessonId).filter((v) => typeof v === 'string')).size,
    forwarded: {
      yes: forwarded.filter((e) => e.props.yes === true).length,
      no: forwarded.filter((e) => e.props.yes !== true).length,
    },
    limitHit: tutorsOf(count(events, 'limit_hit')),
    upgradeInterest: tutorsOf(count(events, 'upgrade_interest')),
    retention: {
      very: retention.filter((e) => e.props.answer === 'very').length,
      little: retention.filter((e) => e.props.answer === 'little').length,
      no: retention.filter((e) => e.props.answer === 'no').length,
    },
    imports: {
      recognized: count(events, 'import_recognized').length,
      failed: count(events, 'import_failed').length,
      series: count(events, 'series_created').length,
    },
  }
}

const REASON_LABELS: Record<string, string> = {
  content: 'ошибки в содержании',
  level: 'не та сложность',
  long: 'слишком длинно',
  short: 'слишком коротко',
  design: 'оформление',
}

const pct = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`)

/** Сводка текстом для сообщения бота. */
export function formatStats(s: StatsSummary): string {
  const rated = s.rated.up + s.rated.down
  const reasons = Object.entries(s.rated.reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${REASON_LABELS[code] ?? code} ${n}`)
    .join(', ')
  const asked = s.forwarded.yes + s.forwarded.no
  const answered = s.retention.very + s.retention.little + s.retention.no

  return [
    '📊 Пилот',
    `Репетиторов: ${s.tutors} · заходили за сутки ${s.seen24h}, за неделю ${s.seen7d}`,
    '',
    '🧾 Материалы',
    `Собрали хотя бы один: ${s.generators} из ${s.tutors}`,
    `Всего собрано: ${s.generated}` +
      (s.generators ? ` (в среднем ${(s.generated / s.generators).toFixed(1)} на человека)` : ''),
    `Вернулись за вторым в другой день: ${s.returners}`,
    `Пересборок: ${s.regenerated} (${pct(s.regenerated, s.generated)} от сборок)`,
    `Медиана сборки: ${s.medianMs === null ? '—' : `${Math.round(s.medianMs / 1000)} с`}`,
    '',
    '👍 Нравится ли',
    `Оценки: 👍 ${s.rated.up} · 👎 ${s.rated.down}` + (rated ? ` (${pct(s.rated.up, rated)} положительных)` : ''),
    reasons ? `Причины 👎: ${reasons}` : null,
    `Правили руками: ${s.edited.materials}, из них сильно (от ${STRONG_EDIT * 100}% текста): ${s.edited.strong}`,
    `Удалили материалов: ${s.deleted}`,
    `Проверка нашла сомнения: ${s.checked.withDoubts} из ${s.checked.total}`,
    '',
    '📤 Использование',
    `Скачано PDF: ${s.downloaded} · отправлено в чат: ${s.sent}`,
    `Материалов, которые скачали или отправили: ${s.usedMaterials} из ${s.generated}`,
    `Дошли до ученика (по ответам репетиторов): да ${s.forwarded.yes}, нет ${s.forwarded.no}` +
      (asked ? '' : ' — пока не спрашивали'),
    '',
    '💰 Готовность платить',
    `Упёрлись в лимит: ${s.limitHit} чел. · «хочу больше материалов»: ${s.upgradeInterest} чел.`,
    `«Расстроитесь, если пропадёт»: очень ${s.retention.very}, немного ${s.retention.little}, нет ${s.retention.no}` +
      (answered ? '' : ' — пока не спрашивали'),
    '',
    '🗓 Расписание',
    `Распознаваний: ${s.imports.recognized} (ошибок ${s.imports.failed}) · серий создано: ${s.imports.series}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

const MSK = 'Europe/Moscow'

/** Последние события одного репетитора для разговора с ним. */
export function formatTimeline(title: string, events: StatEvent[]): string {
  if (events.length === 0) return `${title}\nСобытий пока нет.`
  const when = new Intl.DateTimeFormat('ru-RU', {
    timeZone: MSK,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const lines = events.map((e) => {
    const props = Object.entries(e.props)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(' ')
    return `${when.format(e.createdAt)}  ${e.name}${props ? `  ${props}` : ''}`
  })
  return [title, ...lines].join('\n')
}
