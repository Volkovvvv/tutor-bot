/**
 * Что можно писать в журнал событий.
 *
 * Белый список и очистка props — защита приватности: в журнал не должны попасть
 * темы уроков, тексты материалов и имена учеников, даже если кто-то по ошибке
 * передаст их в track(). Длинная строка отбрасывается, а не обрезается:
 * обрезанная тема всё равно тема.
 */

/** События, которые пишет сервер, глядя на действия репетитора. */
export const SERVER_EVENTS = [
  'material_generated',
  'material_regenerated',
  'material_edited',
  'material_deleted',
  'material_checked',
  'limit_hit',
  'pdf_downloaded',
  'pdf_sent',
  'material_forwarded',
  'retention_answer',
  'import_recognized',
  'import_failed',
  'series_created',
] as const

/** События, которые присылает приложение: сервер сам их не видит. */
export const CLIENT_EVENTS = ['material_rating', 'upgrade_interest'] as const

export type ServerEvent = (typeof SERVER_EVENTS)[number]
export type ClientEvent = (typeof CLIENT_EVENTS)[number]
export type EventName = ServerEvent | ClientEvent

/** Причины низкой оценки материала — коды чипсов в приложении. */
export const RATING_REASONS = ['content', 'level', 'long', 'short', 'design'] as const

export type EventProps = Record<string, string | number | boolean>

const KEY = /^[a-z][a-zA-Z_]{0,29}$/
const MAX_KEYS = 10
const MAX_STRING = 40

export function isEventName(name: unknown): name is EventName {
  return (
    typeof name === 'string' &&
    ((SERVER_EVENTS as readonly string[]).includes(name) || (CLIENT_EVENTS as readonly string[]).includes(name))
  )
}

/** Только числа, булевы и короткие строки; остальное молча отбрасывается. */
export function cleanProps(raw: unknown): EventProps {
  const result: EventProps = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result

  for (const [key, value] of Object.entries(raw)) {
    if (Object.keys(result).length >= MAX_KEYS) break
    if (!KEY.test(key)) continue
    if (typeof value === 'boolean') result[key] = value
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
    else if (typeof value === 'string' && value.length <= MAX_STRING) result[key] = value
  }
  return result
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * props клиентского события: известные поля и строго по формату.
 * Произвольный текст из приложения в журнал не идёт.
 */
export function cleanClientProps(name: ClientEvent, raw: unknown): EventProps {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const result: EventProps = {}

  if (typeof src.lessonId === 'string' && UUID.test(src.lessonId)) result.lessonId = src.lessonId

  if (name === 'material_rating') {
    result.good = src.good === true
    if (typeof src.reason === 'string' && (RATING_REASONS as readonly string[]).includes(src.reason)) {
      result.reason = src.reason
    }
  }
  return result
}
