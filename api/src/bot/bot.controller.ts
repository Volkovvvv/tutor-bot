import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request, Response } from 'express'
import { webhookCallback } from 'grammy'
import { timingSafeEqual } from 'node:crypto'
import { Public } from '../auth/decorators/public.decorator'
import { BotService } from './bot.service'

/**
 * Приём обновлений от Telegram.
 *
 * Роут открытый — Telegram не умеет присылать наш JWT. Единственная
 * защита: секрет в заголовке X-Telegram-Bot-Api-Secret-Token, который
 * Telegram отправляет с каждым обновлением. Без проверки этого заголовка
 * любой человек мог бы прислать поддельное «обновление» с чужим /start
 * и привязаться к карточке ученика.
 */
@Controller('bot')
export class BotController {
  private readonly logger = new Logger(BotController.name)
  private readonly secret: string
  private readonly enabled: boolean
  /**
   * Колбэк создаётся только в webhook-режиме.
   *
   * webhookCallback() помечает экземпляр бота как «запущенный через
   * webhook», и после этого bot.start() отказывается работать. Создать
   * его безусловно означало бы сломать локальный polling.
   */
  private readonly handle: ((req: Request, res: Response) => Promise<void>) | null

  constructor(bot: BotService, config: ConfigService) {
    this.secret = config.get<string>('BOT_WEBHOOK_SECRET') ?? ''
    this.enabled = (config.get<string>('BOT_MODE') ?? 'polling') === 'webhook'
    this.handle = this.enabled ? webhookCallback(bot.instance, 'express') : null
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // В режиме polling эндпоинт не должен работать вовсе.
    if (!this.enabled || !this.handle) throw new ForbiddenException()

    if (!this.matchesSecret(token)) {
      // Ни намёка на причину: подробности помогли бы подбирать секрет.
      throw new ForbiddenException()
    }

    try {
      await this.handle(req, res)
    } catch (e) {
      // Telegram повторяет обновление, пока не получит 2xx. Отдать 500
      // из-за сбоя обработчика — значит зациклить доставку одного и того
      // же сообщения. Ошибку пишем в лог и подтверждаем приём.
      this.logger.error(`Ошибка обработки обновления: ${(e as Error).message}`)
      if (!res.headersSent) res.status(HttpStatus.OK).send()
    }
  }

  /** Сравнение за постоянное время: обычное === утекает секрет побайтово. */
  private matchesSecret(token: string | undefined): boolean {
    if (!token || !this.secret) return false
    const a = Buffer.from(token)
    const b = Buffer.from(this.secret)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }
}
