import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { EventsService } from '../events/events.service'
import { AiService } from '../materials/ai.service'
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

  constructor(
    private readonly ai: AiService,
    private readonly events: EventsService,
  ) {}

  async recognize(tutorId: string, dto: RecognizeScheduleDto): Promise<{ rows: ImportRow[] }> {
    const text = dto.text?.trim()
    if (!dto.image && !text) {
      throw new BadRequestException('Нужно фото расписания или его текст')
    }
    if (!this.ai.enabled) {
      throw new ServiceUnavailableException('Распознавание расписания пока недоступно')
    }

    const messages = buildImportMessages({ image: dto.image, text })
    const startedAt = Date.now()
    try {
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const raw = await this.ai.askImporter(messages)
        const rows = raw ? parseImportRows(raw) : null
        if (rows) {
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
}
