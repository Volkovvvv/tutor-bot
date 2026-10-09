import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Bot, GrammyError, HttpError, InlineKeyboard, InputFile } from 'grammy'
import { StatsService } from '../events/stats.service'
import { InvitesService } from '../invites/invites.service'

/** Итог попытки отправки — понадобится планировщику для журнала. */
export interface SendResult {
  ok: boolean
  /** Ученик заблокировал бота: повторять бессмысленно. */
  blocked?: boolean
  error?: string
}

/** Кнопка под сообщением: data вернётся в callback_query. */
export interface InlineButton {
  text: string
  data: string
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name)
  private readonly bot: Bot
  private readonly mode: string
  /** Telegram ID администратора: /stats и фидбэк — только ему; null — не задан. */
  private readonly adminId: number | null
  /** Адрес мини-аппа для кнопки «Открыть кабинет»; null — кнопки нет. */
  private readonly appUrl: string | null

  constructor(
    private readonly invites: InvitesService,
    private readonly stats: StatsService,
    private readonly config: ConfigService,
  ) {
    this.bot = new Bot(config.getOrThrow<string>('BOT_TOKEN'))
    this.mode = config.get<string>('BOT_MODE') ?? 'polling'
    const admin = Number(config.get('ADMIN_TG_ID'))
    this.adminId = Number.isInteger(admin) && admin > 0 ? admin : null
    if (!this.adminId) this.logger.warn('ADMIN_TG_ID не задан — /stats и фидбэк репетиторов недоступны')
    const appUrl = config.get<string>('MINI_APP_URL')?.trim() ?? ''
    // Telegram принимает в кнопке только https
    this.appUrl = appUrl.startsWith('https://') ? appUrl : null
    this.registerHandlers()
  }

  /** Как репетитору попасть в приложение: кнопкой под сообщением или кнопкой меню. */
  private openHint(): string {
    return this.appUrl ? 'Откройте кабинет кнопкой ниже.' : 'Откройте кабинет кнопкой меню рядом с полем ввода.'
  }

  private openKeyboard(): { reply_markup: InlineKeyboard } | undefined {
    return this.appUrl
      ? { reply_markup: new InlineKeyboard().webApp('Открыть кабинет', this.appUrl) }
      : undefined
  }

  /** Бот подключён к Telegram и может писать; при BOT_MODE=off — нет. */
  get canSend(): boolean {
    return this.mode !== 'off'
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
        // Без кода приходят и репетиторы, и ученики без ссылки: кто перед нами,
        // бот не знает, поэтому говорит обоим, что делать.
        await ctx.reply(
          'Привет! Это помощник репетитора.\n\n' +
            `Вы репетитор? ${this.openHint()} В нём расписание, ученики и материалы к урокам: ` +
            'теория и домашка в PDF.\n\n' +
            'Вы ученик? Откройте ссылку-приглашение от своего репетитора, и напоминания о занятиях будут приходить сюда.',
          this.openKeyboard(),
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

    // Сводка пилота — только администратору. Остальным бот отвечает как на любое
    // другое сообщение: наличие команды не должно быть видно посторонним.
    this.bot.command('stats', async (ctx) => {
      if (!this.adminId || ctx.from?.id !== this.adminId) {
        await ctx.reply('Я только присылаю напоминания о занятиях и не умею отвечать на сообщения.')
        return
      }
      const username = ctx.match?.trim().replace(/^@/, '')
      try {
        const text = username ? await this.stats.timeline(username) : await this.stats.summary()
        await ctx.reply(text ?? `Репетитора @${username} нет`)
      } catch (e) {
        this.logger.error(`Сводка не собрана: ${(e as Error).message}`)
        await ctx.reply('Не удалось собрать сводку, подробности в логе')
      }
    })

    // Показать онбординг заново — только администратору, на его же кабинете
    this.bot.command('onboarding', async (ctx) => {
      if (!this.adminId || ctx.from?.id !== this.adminId) {
        await ctx.reply(`Я не умею отвечать на сообщения. ${this.openHint()}`, this.openKeyboard())
        return
      }
      try {
        const done = await this.stats.resetOnboarding(this.adminId)
        await ctx.reply(
          done
            ? 'Готово. Закройте приложение и откройте снова — знакомство покажется с начала. Предметы, ученики и занятия остались.'
            : 'Кабинета ещё нет: откройте приложение один раз.',
          this.openKeyboard(),
        )
      } catch (e) {
        this.logger.error(`Онбординг не сброшен: ${(e as Error).message}`)
        await ctx.reply('Не получилось, подробности в логе')
      }
    })

    // Любое другое сообщение: бот не диалоговый, объясняем это прямо.
    this.bot.on('message', async (ctx) => {
      await ctx.reply(
        `Я не умею отвечать на сообщения. ${this.openHint()} Написать разработчику можно прямо в нём.`,
        this.openKeyboard(),
      )
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
  async sendMessage(tgId: bigint, text: string, buttons?: InlineButton[]): Promise<SendResult> {
    // Локально бот выключен: не пишем реальным людям из тестовой базы.
    if (this.mode === 'off') {
      this.logger.debug(`BOT_MODE=off, сообщение для ${tgId} не отправлено: ${text}`)
      return { ok: false, error: 'BOT_MODE=off' }
    }
    try {
      const keyboard = buttons ? new InlineKeyboard() : undefined
      for (const b of buttons ?? []) keyboard?.text(b.text, b.data)
      await this.bot.api.sendMessage(Number(tgId), text, keyboard ? { reply_markup: keyboard } : undefined)
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

  /** Сообщение администратору (фидбэк репетиторов). Без ADMIN_TG_ID — молча ничего. */
  async notifyAdmin(text: string): Promise<SendResult> {
    if (!this.adminId) return { ok: false, error: 'ADMIN_TG_ID не задан' }
    return this.sendMessage(BigInt(this.adminId), text)
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
    })
    this.logger.log(`Webhook установлен: ${url}`)
  }

  private async startPolling(): Promise<void> {
    // Снимаем webhook, иначе Telegram не отдаёт обновления через getUpdates.
    // Накопившиеся за перезапуск обновления не выбрасываем: среди них /start
    // ученика по приглашению — потеряв его, ученик останется не привязан.
    await this.bot.api.deleteWebhook()
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
