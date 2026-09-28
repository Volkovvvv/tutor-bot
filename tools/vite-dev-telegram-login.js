import { createHmac } from 'node:crypto'
import { loadEnv } from 'vite'

/**
 * Вход без Telegram при локальной разработке.
 *
 * Бэкенд пускает только по initData с подписью токена бота, и поблажек
 * в нём нет намеренно. Поэтому вместо обхода проверки dev-сервер сам
 * подписывает initData тестового пользователя токеном из api/.env —
 * ровно так, как это делает Telegram. Сервер проверяет подпись как обычно.
 *
 * Работает только в `vite dev` (в сборку не попадает) и отвечает только
 * запросам с этого же компьютера: подписанный initData — это пропуск
 * в кабинет, и отдавать его в локальную сеть нельзя.
 */

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function signInitData(botToken, user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'dev',
    user: JSON.stringify(user),
  })

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'))
  return params.toString()
}

export default function devTelegramLogin() {
  return {
    name: 'dev-telegram-login',
    apply: 'serve',

    configureServer(server) {
      const { mode, root } = server.config
      // Токен бота — из api/.env, чтобы не дублировать секрет во фронте
      const apiEnv = loadEnv(mode, `${root}/api`, '')
      // Тестовый пользователь — из .env.development(.local) фронта
      const env = loadEnv(mode, root, 'DEV_TG_')

      server.middlewares.use('/__dev/init-data', (req, res) => {
        if (!LOOPBACK.has(req.socket.remoteAddress)) {
          res.statusCode = 403
          res.end('dev-вход доступен только с этого компьютера')
          return
        }
        if (!apiEnv.BOT_TOKEN) {
          res.statusCode = 500
          res.end('В api/.env нет BOT_TOKEN')
          return
        }

        const user = {
          id: Number(env.DEV_TG_USER_ID || 100000001),
          first_name: env.DEV_TG_FIRST_NAME || 'Dev',
          username: env.DEV_TG_USERNAME || 'dev_tutor',
        }

        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end(signInitData(apiEnv.BOT_TOKEN, user))
      })
    },
  }
}
