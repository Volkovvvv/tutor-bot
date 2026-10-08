import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { type ClientEvent, cleanClientProps, cleanProps, type EventName, isEventName } from './event-names'

/**
 * Журнал событий пилота. Пишет только счётчики и коды — см. event-names.ts.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записать событие. Не бросает исключений: статистика вторична,
   * и сбой записи не должен ломать то действие, которое она описывает.
   */
  async track(tutorId: string, name: EventName, props: Record<string, unknown> = {}): Promise<void> {
    if (!isEventName(name)) return
    try {
      await this.prisma.event.create({
        data: { tutorId, name, props: cleanProps(props) as Prisma.InputJsonObject },
      })
    } catch (e) {
      this.logger.warn(`Событие ${name} не записано: ${(e as Error).message}`)
    }
  }

  /** Событие из приложения: поля props разбираются строго по имени события. */
  trackClient(tutorId: string, name: ClientEvent, props: unknown): Promise<void> {
    return this.track(tutorId, name, cleanClientProps(name, props))
  }

  async saveFeedback(tutorId: string, text: string, screen?: string): Promise<void> {
    await this.prisma.feedback.create({
      data: { tutorId, text: text.trim(), screen: screen?.trim() || null },
    })
  }
}
