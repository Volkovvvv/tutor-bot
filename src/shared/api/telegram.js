// Тонкая обёртка над Telegram WebApp SDK.
// Вне Telegram tg === null и все вызовы становятся no-op.

const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

// Скрипт telegram-web-app.js подключается всегда, поэтому объект WebApp существует
// и в обычном браузере. Признак реального запуска из Telegram — непустой initData
// либо platform, отличный от 'unknown'. Иначе считаем, что Telegram нет:
// MainButton там невидим, и без этой проверки форму было бы нечем отправить.
export const isTelegram = Boolean(
  webApp && (webApp.initData || (webApp.platform && webApp.platform !== 'unknown'))
)

export const tg = isTelegram ? webApp : null

/**
 * Подписанная строка initData для входа на бэкенде.
 *
 * Читается в момент вызова, а не при импорте модуля: на части клиентов
 * (в первую очередь Telegram Desktop) WebApp заполняется не мгновенно,
 * и значение, снятое на этапе импорта, оказывается пустым.
 *
 * Запасной путь — window.location.hash: Telegram кладёт туда
 * tgWebAppData с той же подписью, и оттуда её можно взять, даже если
 * SDK ещё не успел разобрать параметры.
 */
export function getInitData() {
  const fromSdk = window.Telegram?.WebApp?.initData
  if (fromSdk) return fromSdk

  try {
    const hash = window.location.hash.slice(1)
    const fromHash = new URLSearchParams(hash).get('tgWebAppData')
    if (fromHash) return fromHash
  } catch {
    // формат hash неожиданный — считаем, что данных нет
  }

  return null
}

export function initTelegram() {
  if (!tg) return
  tg.ready()
  tg.expand()
}

// Значения themeParams приходят как #rrggbb. Подставляем их в CSS-переменные,
// а дефолты в shared/ui/index.css срабатывают, когда Telegram недоступен.
export function applyTheme() {
  if (!tg) return
  const p = tg.themeParams || {}
  const map = {
    '--bg': p.bg_color,
    '--text': p.text_color,
    '--hint': p.hint_color,
    '--link': p.link_color,
    '--button': p.button_color,
    '--button-text': p.button_text_color,
    '--card': p.secondary_bg_color,
  }
  const root = document.documentElement
  for (const [name, value] of Object.entries(map)) {
    if (value) root.style.setProperty(name, value)
  }
  if (p.bg_color) document.body.style.backgroundColor = p.bg_color
}

export function haptic(type = 'light') {
  try {
    tg?.HapticFeedback?.impactOccurred(type)
  } catch {
    // не поддерживается — игнорируем
  }
}

// Открыть чат с учеником. По username это обычная ссылка t.me;
// по числовому id работает только схема tg://, и то не на всех платформах.
export function openChat({ username, tgId }) {
  if (username) {
    const url = `https://t.me/${username}`
    if (tg?.openTelegramLink) tg.openTelegramLink(url)
    else window.open(url, '_blank', 'noopener')
    return true
  }
  if (tgId && tg) {
    // Из Mini App это иногда игнорируется клиентом — вызываем как best effort
    try {
      tg.openTelegramLink(`tg://user?id=${tgId}`)
      return true
    } catch {
      return false
    }
  }
  return false
}

// Отправить текст в выбранный чат: открывает нативный пикер Telegram.
// Вне Telegram (и на старых версиях) откатываемся на копирование в буфер.
export function shareText(text) {
  if (tg?.switchInlineQuery) {
    try {
      tg.switchInlineQuery(text, ['users'])
      return 'shared'
    } catch {
      // ниже отработает копирование
    }
  }
  try {
    navigator.clipboard?.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// Копирование в буфер: в Mini App clipboard доступен не всегда,
// поэтому есть запасной путь через скрытый textarea.
export function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // ниже отработает запасной вариант
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
