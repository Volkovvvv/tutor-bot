import { Injectable, Logger } from '@nestjs/common'
import { ReminderKind } from '@prisma/client'
import { BotService } from '../bot/bot.service'
import { PrismaService } from '../prisma/prisma.service'
import { debtReminderText, lessonReminderText } from './messages'
import { planReminders } from './schedule'

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
   * Создаёт записи напоминаний для занятия.
   *
   * Вызывается при создании и изменении занятия. Идемпотентна:
   * @@unique([lessonId, kind]) не даст создать дубль, а skipDuplicates
   * превращает повторный вызов в пустую операцию.
   */
  async planForLesson(lessonId: string, now = new Date()): Promise<number> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        startsAt: true,
        status: true,
        student: {
          select: {
            userId: true,
            archivedAt: true,
            notify: {
              select: { enabled: true, beforeHours: true, beforeMinutes: true },
            },
          },
        },
      },
    })

    if (!lesson) return 0
    // Напоминать о прошедшем или отменённом занятии смысла нет.
    if (lesson.status !== 'PLANNED') return 0
    // Ученик не подключён к боту — писать некуда.
    if (!lesson.student.userId || lesson.student.archivedAt) return 0

    const notify = lesson.student.notify
    if (!notify) return 0

    const planned = planReminders(lesson.startsAt, notify, now)
    if (planned.length === 0) return 0

    const result = await this.prisma.reminder.createMany({
      data: planned.map((p) => ({
        lessonId: lesson.id,
        kind: p.kind,
        scheduledAt: p.scheduledAt,
      })),
      // Повторный вызов после правки занятия не должен падать.
      skipDuplicates: true,
    })

    return result.count
  }

  /**
   * Пересоздаёт напоминания после изменения занятия.
   *
   * Сдвинули занятие на другой день — прежние времена отправки
   * неверны. Уже отправленные не трогаем: из них и состоит защита
   * от повторной отправки.
   */
  async replanForLesson(lessonId: string, now = new Date()): Promise<void> {
    await this.prisma.reminder.deleteMany({
      where: { lessonId, sentAt: null },
    })
    await this.planForLesson(lessonId, now)
  }

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
        reminder.kind === ReminderKind.BEFORE_MINUTES,
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
   * Напоминания о неоплаченных занятиях.
   *
   * Отдельно от напоминаний о занятиях: долг не привязан к одному
   * занятию, и слать по сообщению на каждое неоплаченное — спам.
   * Одно сообщение с суммой за всё.
   *
   * Вызывается раз в сутки; частота выбрана не «на глаз»: напоминание
   * об оплате чаще раза в день раздражает и приводит к блокировке бота.
   *
   * Защита от повторов — запись Reminder с kind: DEBT на самом старом
   * неоплаченном занятии. @@unique([lessonId, kind]) не даст создать
   * вторую, поэтому двойной запуск cron не приведёт к двум сообщениям.
   * Запись снимается, когда это занятие оплачено или долг закрыт.
   */
  async dispatchDebts(now = new Date()): Promise<{ sent: number }> {
    // Кандидаты: подключённые ученики с включённым debtReminder,
    // у которых есть прошедшие неоплаченные занятия.
    const students = await this.prisma.student.findMany({
      where: {
        archivedAt: null,
        userId: { not: null },
        notify: { enabled: true, debtReminder: true },
        lessons: { some: { status: 'DONE', paidAt: null } },
      },
      select: {
        id: true,
        name: true,
        user: { select: { tgId: true } },
        lessons: {
          where: { status: 'DONE', paidAt: null },
          // Старейшее первым: к нему привяжем отметку об отправке.
          orderBy: { startsAt: 'asc' },
          select: { id: true, price: true },
        },
      },
      take: BATCH_SIZE,
    })

    let sent = 0

    for (const student of students) {
      if (!student.user || student.lessons.length === 0) continue

      const total = student.lessons.reduce((sum, l) => sum + l.price, 0)
      // Долг в ноль копеек (бесплатные занятия) напоминать не о чем.
      if (total <= 0) continue

      // Ставим отметку до отправки: при гонке двух тиков второй получит
      // нарушение уникальности и пропустит ученика.
      const anchorId = student.lessons[0].id
      try {
        await this.prisma.reminder.create({
          data: { lessonId: anchorId, kind: ReminderKind.DEBT, scheduledAt: now, sentAt: now },
        })
      } catch {
        // Отметка уже есть — про этот долг ученику писали.
        continue
      }

      const text = debtReminderText(student.name, student.lessons.length, total)
      const result = await this.bot.sendMessage(student.user.tgId, text)
      if (result.ok) {
        sent += 1
      } else {
        this.logger.warn(`Долг не отправлен ученику ${student.id}: ${result.error}`)
        // Не ушло — снимаем отметку, чтобы попробовать в следующий раз.
        await this.prisma.reminder.deleteMany({
          where: { lessonId: anchorId, kind: ReminderKind.DEBT },
        })
      }
    }

    if (sent > 0) this.logger.log(`Напоминаний о долге отправлено: ${sent}`)
    return { sent }
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
