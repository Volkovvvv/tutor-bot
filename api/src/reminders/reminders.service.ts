import { Injectable, Logger } from '@nestjs/common'
import { BotService } from '../bot/bot.service'
import { PrismaService } from '../prisma/prisma.service'
import { lessonReminderText } from './messages'

/** Сколько напоминаний берём за один тик. Защита от долгого цикла. */
const BATCH_SIZE = 100

/**
 * Сколько попыток делаем, прежде чем сдаться.
 * Сеть моргнула — повторим; Telegram отказал навсегда — остановимся.
 */
const MAX_ATTEMPTS = 3

/**
 * Насколько просроченное напоминание ещё имеет смысл отправлять.
 *
 * Если сервис лежал сутки, присылать «занятие через час» про занятие,
 * которое уже прошло, хуже, чем промолчать.
 */
const STALE_AFTER_MS = 2 * 3_600_000

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
  ) {}

  /**
   * Отправляет напоминания, которым пришло время.
   *
   * Каждое обрабатывается отдельно и в своём try: ученик, заблокировавший
   * бота, не должен останавливать рассылку остальным.
   */
  async dispatchDue(now = new Date()): Promise<{ sent: number; failed: number }> {
    const due = await this.prisma.reminder.findMany({
      where: {
        sentAt: null,
        scheduledAt: { lte: now },
        attempts: { lt: MAX_ATTEMPTS },
      },
      select: {
        id: true,
        kind: true,
        scheduledAt: true,
        attempts: true,
        lesson: {
          select: {
            id: true,
            startsAt: true,
            status: true,
            student: {
              select: {
                name: true,
                archivedAt: true,
                notify: { select: { enabled: true } },
                user: { select: { tgId: true } },
                tutor: { select: { user: { select: { timezone: true } } } },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: BATCH_SIZE,
    })

    let sent = 0
    let failed = 0

    for (const reminder of due) {
      const lesson = reminder.lesson
      const student = lesson.student

      // Условия могли измениться с момента планирования: занятие отменили,
      // ученика заархивировали, уведомления выключили, связь с ботом
      // потерялась.
      if (
        lesson.status !== 'PLANNED' ||
        student.archivedAt !== null ||
        student.notify?.enabled !== true ||
        student.user === null
      ) {
        await this.markSent(reminder.id, 'Отменено: условия изменились')
        continue
      }

      // Просроченное напоминание о прошедшем занятии только смутит ученика.
      if (now.getTime() - reminder.scheduledAt.getTime() > STALE_AFTER_MS) {
        await this.markSent(reminder.id, 'Пропущено: слишком поздно')
        continue
      }

      const text = lessonReminderText(
        student.name,
        lesson.startsAt,
        student.tutor.user.timezone,
        now,
      )

      try {
        const result = await this.bot.sendMessage(student.user.tgId, text)

        if (result.ok) {
          await this.markSent(reminder.id)
          sent += 1
          continue
        }

        failed += 1
        // Заблокировал бота — повторять бессмысленно, закрываем запись.
        if (result.blocked) {
          await this.markSent(reminder.id, `Заблокирован: ${result.error ?? ''}`)
        } else {
          await this.markFailed(reminder.id, result.error ?? 'Неизвестная ошибка')
        }
      } catch (e) {
        // Сюда попадаем только при неожидаемом сбое: sendMessage
        // сам не бросает. Всё равно ловим — цикл не должен прерваться.
        failed += 1
        await this.markFailed(reminder.id, (e as Error).message)
      }
    }

    if (sent > 0 || failed > 0) {
      this.logger.log(`Напоминания: отправлено ${sent}, с ошибкой ${failed}`)
    }

    return { sent, failed }
  }

  /**
   * Закрывает запись: sentAt заполнен — значит повторов не будет.
   * Это и есть защита от дублей вместе с @@unique в схеме.
   */
  private async markSent(id: string, note?: string): Promise<void> {
    await this.prisma.reminder.update({
      where: { id },
      data: { sentAt: new Date(), error: note ?? null },
    })
  }

  /** Оставляет запись открытой для следующей попытки. */
  private async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.reminder.update({
      where: { id },
      // Срез error: описание ошибки Telegram может быть длинным,
      // а колонка нужна для диагностики, не для хранения трассировок.
      data: { attempts: { increment: 1 }, error: error.slice(0, 500) },
    })
  }
}
