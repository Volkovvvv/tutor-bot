import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Проверка подписи Telegram initData.
 *
 * Это единственное, что отделяет данные репетитора от любого человека
 * с curl: без проверки HMAC клиент присылает какой угодно tgId и получает
 * чужой кабинет. Поэтому здесь нет ни одной «удобной» поблажки.
 *
 * Алгоритм (docs: core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 *   secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   hash   = HMAC_SHA256(key=secret, msg=data_check_string)
 * где data_check_string — все поля кроме hash, отсортированные по имени,
 * склеенные как "key=value" через \n.
 */

export interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
  languageCode?: string
  isPremium?: boolean
}

export interface InitData {
  user: TelegramUser
  authDate: Date
  /** Параметр из deep link t.me/<bot>?startapp=<...> */
  startParam?: string
  chatInstance?: string
}

export class InitDataError extends Error {}

/** Поле user приходит JSON-строкой; берём только то, что нам нужно. */
function parseUser(raw: string): TelegramUser {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new InitDataError('Поле user не является корректным JSON')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new InitDataError('Поле user не является объектом')
  }

  const u = parsed as Record<string, unknown>

  // id обязателен и должен быть числом: на нём держится вся идентификация.
  if (typeof u.id !== 'number' || !Number.isSafeInteger(u.id) || u.id <= 0) {
    throw new InitDataError('Некорректный user.id')
  }
  if (typeof u.first_name !== 'string' || u.first_name.length === 0) {
    throw new InitDataError('Отсутствует user.first_name')
  }

  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined)

  return {
    id: u.id,
    firstName: u.first_name,
    lastName: str(u.last_name),
    username: str(u.username),
    photoUrl: str(u.photo_url),
    languageCode: str(u.language_code),
    isPremium: u.is_premium === true,
  }
}

/**
 * Разбирает и проверяет initData. Бросает InitDataError при любой проблеме —
 * вызывающий обязан считать это отказом в доступе, а не поводом
 * продолжить с частичными данными.
 *
 * @param maxAgeSeconds окно жизни подписи. Нужно, чтобы перехваченная
 *   строка initData не работала вечно: подпись валидна всегда, защищает
 *   только срок. По умолчанию 24 часа — Telegram не обновляет initData,
 *   пока мини-апп открыт, поэтому окно меньше рвало бы живые сессии.
 */
export function verifyInitData(
  raw: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): InitData {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new InitDataError('Пустой initData')
  }
  // Защита от мусорных гигантских строк до любого разбора.
  if (raw.length > 8192) {
    throw new InitDataError('initData слишком длинный')
  }

  const params = new URLSearchParams(raw)

  const hash = params.get('hash')
  if (!hash) throw new InitDataError('В initData нет hash')
  // hash — строго hex-SHA256; проверяем до сравнения,
  // чтобы timingSafeEqual не получил буферы разной длины.
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new InitDataError('Некорректный формат hash')
  }

  // data_check_string: все поля кроме hash, отсортированные по имени.
  // signature — поле новой Ed25519-схемы Telegram, в HMAC не участвует.
  const pairs: string[] = []
  for (const [key, value] of params.entries()) {
    if (key === 'hash' || key === 'signature') continue
    pairs.push(`${key}=${value}`)
  }
  pairs.sort()
  const dataCheckString = pairs.join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const actual = Buffer.from(hash, 'hex')

  // Сравнение за постоянное время: обычное === утекает подпись побайтово.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new InitDataError('Подпись initData не совпадает')
  }

  // Подпись верна — но она верна вечно. Срок проверяем отдельно.
  const authDateRaw = params.get('auth_date')
  if (!authDateRaw || !/^\d{1,10}$/.test(authDateRaw)) {
    throw new InitDataError('Некорректный auth_date')
  }
  const authDateSeconds = Number(authDateRaw)
  const ageSeconds = Math.floor(Date.now() / 1000) - authDateSeconds
  if (ageSeconds > maxAgeSeconds) {
    throw new InitDataError('initData просрочен')
  }
  // Заметный сдвиг в будущее означает подделанные часы или чужую подпись.
  if (ageSeconds < -300) {
    throw new InitDataError('auth_date в будущем')
  }

  const userRaw = params.get('user')
  if (!userRaw) {
    // Так бывает в inline-режиме: подпись валидна, но пользователя нет.
    // Нам нужен именно пользователь, поэтому это отказ.
    throw new InitDataError('В initData нет user')
  }

  return {
    user: parseUser(userRaw),
    authDate: new Date(authDateSeconds * 1000),
    startParam: params.get('start_param') ?? undefined,
    chatInstance: params.get('chat_instance') ?? undefined,
  }
}
