import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Bot, GrammyError, HttpError, InputFile } from 'grammy'
import { InvitesService } from '../invites/invites.service'

/** Итог попытки отправки — понадобится планировщику для журнала. */
export interface SendResult {
  ok: boolean
  /** Ученик заблокировал бота: повторять бессмысленно. */
  blocked?: boolean
  error?: string
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name)
  private readonly bot: Bot
  private readonly mode: string

  constructor(
    private readonly invites: InvitesService,
    private readonly config: ConfigService,
  ) {
    this.bot = new Bot(config.getOrThrow<string>('BOT_TOKEN'))
    this.mode = config.get<string>('BOT_MODE') ?? 'polling'
    this.registerHandlers()
  }

  /** Экземпляр для webhook-колбэка; планировщик пользуется sendMessage. */
  get instance(): Bot {
    return this.bot
  }

  private registerHandlers(): void {
    // Единственная команда, которая что-то меняет в данных.
    this.bot.command('start', async (ctx) => {
      const payload = ctx.match?.trim()
      const from = ctx.from
      if (!from) return

      if (!payload) {
        // Пришёл без кода — просто объясняем, что делать.
        await ctx.reply(
          'Привет! Этот бот присылает напоминания о занятиях.\n\n' +
            'Чтобы подключиться, откройте ссылку-приглашение от своего репетитора.',
        )
        return
      }

      const result = await this.invites.accept(payload, {
        id: from.id,
        firstName: from.first_name,
        lastName: from.last_name,
        username: from.username,
      })

      if (!result) {
        // Один и тот же ответ на все причины отказа: иначе по тексту
        // можно отличить «нет такого кода» от «код занят» и подбирать ссылки.
        await ctx.reply(
          'Ссылка недействительна или уже использована.\n' +
            'Попросите репетитора отправить новую.',
        )
        return
      }

      await ctx.reply(
        `Готово, ${result.studentName}! Напоминания о занятиях будут приходить сюда.`,
      )
      this.logger.log(`Ученик подключён: ${result.studentId}`)
    })

    // Любое другое сообщение: бот не диалоговый, объясняем это прямо.
    this.bot.on('message', async (ctx) => {
      await ctx.reply('Я только присылаю напоминания о занятиях и не умею отвечать на сообщения.')
    })

    // Ошибки не должны валить процесс: бот принимает ввод
    // от произвольных людей, и падение здесь остановило бы весь API.
    this.bot.catch((err) => {
      const e = err.error
      if (e instanceof GrammyError) {
        this.logger.error(`Telegram отклонил запрос: ${e.description}`)
      } else if (e instanceof HttpError) {
        this.logger.error(`Сеть недоступна: ${e.message}`)
      } else {
        this.logger.error(`Ошибка бота: ${String(e)}`)
      }
    })
  }

  /**
   * Отправка сообщения ученику.
   *
   * Не бросает исключений: вызывающий (планировщик) обрабатывает
   * сотни отправок, и падение на одной заблокировавшей бота остановило бы
   * рассылку остальным.
   */
  async sendMessage(tgId: bigint, text: string): Promise<SendResult> {
    // Локально бот выключен: не пишем реальным людям из тестовой базы.
    if (this.mode === 'off') {
      this.logger.debug(`BOT_MODE=off, сообщение для ${tgId} не отправлено: ${text}`)
      return { ok: false, error: 'BOT_MODE=off' }
    }
    try {
      await this.bot.api.sendMessage(Number(tgId), text)
      return { ok: true }
    } catch (e) {
      if (e instanceof GrammyError) {
        // 403 — заблокировал бота или удалил чат: повторять нет смысла.
        const blocked = e.error_code === 403
        return { ok: false, blocked, error: e.description }
      }
      return { ok: false, error: (e as Error).message }
    }
  }

  /** Отправка файла. Как и sendMessage, не бросает исключений. */
  async sendDocument(
    tgId: bigint,
    file: Buffer,
    filename: string,
    caption?: string,
  ): Promise<SendResult> {
    if (this.mode === 'off') {
      this.logger.debug(`BOT_MODE=off, файл ${filename} для ${tgId} не отправлен`)
      return { ok: false, error: 'BOT_MODE=off' }
    }
    try {
      await this.bot.api.sendDocument(Number(tgId), new InputFile(file, filename), { caption })
      return { ok: true }
    } catch (e) {
      if (e instanceof GrammyError) {
        return { ok: false, blocked: e.error_code === 403, error: e.description }
      }
      return { ok: false, error: (e as Error).message }
    }
  }

  /**
   * Подключение к Telegram при старте.
   *
   * Ошибки логируются, но не бросаются: недоступный Telegram или сбитая
   * настройка webhook не должны мешать API подняться. Иначе перезапуск
   * на хостинге в неудачный момент оставил бы приложение лежащим,
   * хотя ученики и деньги доступны и без бота.
   */
  async onModuleInit(): Promise<void> {
    try {
      if (this.mode === 'off') {
        this.logger.log('BOT_MODE=off — бот не подключён, напоминания не отправляются')
      } else if (this.mode === 'webhook') {
        await this.startWebhook()
      } else {
        await this.startPolling()
      }
    } catch (e) {
      this.logger.error(
        `Бот не запущен (${(e as Error).message}). API работает, напоминания не отправляются.`,
      )
    }
  }

  private async startWebhook(): Promise<void> {
    const base = this.config.getOrThrow<string>('BOT_PUBLIC_URL').replace(/\/$/, '')
    const url = `${base}/api/bot/webhook`
    await this.bot.api.setWebhook(url, {
      secret_token: this.config.getOrThrow<string>('BOT_WEBHOOK_SECRET'),
      // Пропускаем накопившиеся за простой обновления: напоминания
      // всё равно шлёт планировщик, а старые /start уже неактуальны.
      drop_pending_updates: true,
    })
    this.logger.log(`Webhook установлен: ${url}`)
  }

  private async startPolling(): Promise<void> {
    // Снимаем webhook, иначе Telegram не отдаёт обновления через getUpdates.
    await this.bot.api.deleteWebhook({ drop_pending_updates: true })
    // start() не завершается, пока бот работает, поэтому не ждём его:
    // иначе инициализация модуля никогда не закончится.
    void this.bot.start({
      onStart: () => this.logger.log('Бот запущен в режиме polling'),
    })
  }

  async onModuleDestroy(): Promise<void> {
    if (this.mode === 'polling') {
      await this.bot.stop()
    }
  }
}
