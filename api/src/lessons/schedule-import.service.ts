import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventsService } from '../events/events.service'
import { AiService } from '../materials/ai.service'
import { importsLimit } from '../materials/material-content'
import { PrismaService } from '../prisma/prisma.service'
import type { RecognizeScheduleDto } from './dto/import-schedule.dto'
import { buildImportMessages, type ImportRow, parseImportRows } from './schedule-import'

// Модель иногда возвращает текст вместо JSON — одна повторная попытка
// обычно лечит это, больше только затягивает ожидание.
const ATTEMPTS = 2

/**
 * Читает расписание с фото или из текста.
 *
 * В базу ничего не пишет: распознанные строки уходят репетитору на проверку,
 * а занятия создаёт уже он сам — через POST /lessons/bulk. Ошибка
 * распознавания, сохранённая молча, обернулась бы напоминанием ученику
 * не в то время.
 */
@Injectable()
export class ScheduleImportService {
  private readonly logger = new Logger(ScheduleImportService.name)

  /** Сколько расписаний ИИ распознает одному репетитору; null — без лимита. */
  private readonly limit: number | null
  /** Администратору лимит не считается: он распознаёт расписания, проверяя сервис. */
  private readonly adminTgId: string | null

  constructor(
    private readonly ai: AiService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.limit = importsLimit(config.get('AI_IMPORTS_LIMIT'))
    this.adminTgId = String(config.get('ADMIN_TG_ID') ?? '').trim() || null
  }

  async recognize(tutorId: string, dto: RecognizeScheduleDto): Promise<{ rows: ImportRow[] }> {
    const text = dto.text?.trim()
    if (!dto.image && !text) {
      throw new BadRequestException('Нужно фото расписания или его текст')
    }
    if (!this.ai.enabled) {
      throw new ServiceUnavailableException('Распознавание расписания пока недоступно')
    }
    await this.assertWithinLimit(tutorId)

    const messages = buildImportMessages({ image: dto.image, text })
    const startedAt = Date.now()
    try {
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const raw = await this.ai.askImporter(messages)
        const rows = raw ? parseImportRows(raw) : null
        if (rows) {
          // В лимит идёт только удавшееся распознавание
          await this.prisma.tutor.update({ where: { id: tutorId }, data: { scheduleImports: { increment: 1 } } })
          await this.events.track(tutorId, 'import_recognized', {
            kind: dto.image ? 'photo' : 'text',
            rows: rows.length,
            unsure: rows.filter((r) => r.unsure).length,
            ms: Date.now() - startedAt,
          })
          return { rows }
        }
        this.logger.warn(`Расписание не разобрано (попытка ${attempt}): ${raw?.slice(0, 300)}`)
      }
    } catch (e) {
      // Сбой модели или сети — тоже «не получилось»
      await this.events.track(tutorId, 'import_failed', { kind: dto.image ? 'photo' : 'text', error: true })
      throw e
    }
    await this.events.track(tutorId, 'import_failed', { kind: dto.image ? 'photo' : 'text' })
    throw new ServiceUnavailableException('Не получилось прочитать расписание. Попробуйте ещё раз')
  }

  private async assertWithinLimit(tutorId: string): Promise<void> {
    if (this.limit === null) return
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      select: { scheduleImports: true, user: { select: { tgId: true } } },
    })
    if (!tutor) return
    const isAdmin = this.adminTgId !== null && String(tutor.user.tgId) === this.adminTgId
    if (isAdmin || tutor.scheduleImports < this.limit) return
    await this.events.track(tutorId, 'import_limit_hit', { used: tutor.scheduleImports })
    throw new ForbiddenException(
      `Пробный лимит исчерпан: ИИ распознал ${this.limit} расписаний. Занятия можно добавлять вручную`,
    )
  }
}
