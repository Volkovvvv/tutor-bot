// Тонкий HTTP-клиент к бэкенду. Держит JWT в памяти и в localStorage,
// подставляет заголовок Authorization, разбирает ошибки в единый формат.
import { getInitData } from './telegram.js'

export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'
const TOKEN_KEY = 'tutor-crm:token'

let token = null
try {
  token = localStorage.getItem(TOKEN_KEY)
} catch {
  // приватный режим — работаем без сохранения токена между сессиями
}

export function getToken() {
  return token
}

function setToken(next) {
  token = next
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // квота/приватный режим — токен всё равно живёт в памяти на сессию
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...options.headers }
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    // Токен истёк или недействителен — сбрасываем, чтобы приложение
    // заново прошло вход при следующем действии.
    setToken(null)
  }

  if (!res.ok) {
    let message = `Ошибка ${res.status}`
    try {
      const body = await res.json()
      message = body.message ?? message
    } catch {
      // тело не JSON — оставляем обобщённое сообщение
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

// Вход по initData. Telegram отдаёт initData как готовую подписанную
// строку — бэкенд проверяет её HMAC-подписью токена бота.
export async function login() {
  let initData = getInitData()
  // Локальная разработка в обычном браузере: подписанный initData тестового
  // пользователя выдаёт dev-сервер (tools/vite-dev-telegram-login.js).
  // В продакшен-сборке import.meta.env.DEV = false, ветка вырезается целиком.
  if (!initData && import.meta.env.DEV) {
    initData = await devInitData()
  }
  if (!initData) {
    throw new ApiError(0, 'Приложение открыто не из Telegram — вход невозможен')
  }
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData }),
  })
  if (!res.ok) {
    // Сервер намеренно не раскрывает, что именно не сошлось в подписи
    // (это помогало бы её подбирать), но код ответа стоит показать —
    // иначе при разборе проблемы видно только «не удалось войти».
    throw new ApiError(res.status, `Сервер отклонил вход (код ${res.status})`)
  }
  const data = await res.json()
  setToken(data.accessToken)
  return data
}

async function devInitData() {
  const res = await fetch('/__dev/init-data')
  if (!res.ok) {
    throw new ApiError(res.status, `Dev-вход не сработал: ${await res.text()}`)
  }
  return res.text()
}

export function logout() {
  setToken(null)
}
