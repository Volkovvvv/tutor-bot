import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { RemindersService } from './reminders.service'

/**
 * Запуск рассылки по расписанию.
 *
 * Отдельный класс от RemindersService: сервис можно вызвать из тестов
 * и из кода, не запуская cron, а здесь только привязка ко времени.
 */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name)
  /**
   * Тик не должен накладываться на предыдущий: медленный Telegram
   * иначе дал бы два параллельных прохода по одной выборке.
   */
  private running = false

  constructor(private readonly reminders: RemindersService) {}

  /**
   * Раз в минуту. Точность до минуты достаточна для напоминаний
   * о занятиях и дешева: выборка идёт по индексу [sentAt, scheduledAt].
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.warn('Предыдущий проход ещё идёт — пропускаем тик')
      return
    }

    this.running = true
    try {
      await this.reminders.dispatchDue()
    } catch (e) {
      // Cron не должен умолкнуть навсегда из-за одной ошибки.
      this.logger.error(`Сбой рассылки: ${(e as Error).message}`)
    } finally {
      this.running = false
    }
  }
}
