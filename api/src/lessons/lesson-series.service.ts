import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ReminderPlanner } from '../reminders/reminder-planner.service'
import type { CreateSeriesDto } from './dto/series.dto'
import { LESSON_SELECT, type LessonView } from './lessons.service'
import { horizonFrom, sameWeeklySlot, seriesOccurrences } from './series'

/**
 * Повторяющиеся занятия.
 *
 * Серия порождает обычные строки Lesson на SERIES_HORIZON_WEEKS недель вперёд,
 * а раз в час горизонт продлевается. Отдельно взятое занятие серии правится
 * и удаляется как любое другое — см. комментарий к LessonSeries в схеме.
 */
@Injectable()
export class LessonSeriesService {
  private readonly logger = new Logger(LessonSeriesService.name)
  private extending = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: ReminderPlanner,
  ) {}

  async create(tutorId: string, dto: CreateSeriesDto): Promise<{ created: LessonView[]; skipped: number }> {
    const studentIds = [...new Set(dto.series.map((s) => s.studentId))]
    // Та же проверка, что у разового занятия: все ученики — этого репетитора.
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, tutorId },
      select: { id: true, price: true, archivedAt: true },
    })
    if (students.length !== studentIds.length) throw new NotFoundException('Ученик не найден')
    if (students.some((s) => s.archivedAt)) {
      throw new BadRequestException('Ученик в архиве — восстановите карточку')
    }
    const priceOf = new Map(students.map((s) => [s.id, s.price]))

    const tutor = await this.prisma.tutor.findUniqueOrThrow({
      where: { id: tutorId },
      select: { user: { select: { timezone: true } } },
    })
    const timezone = tutor.user.timezone

    // Живые серии этих учеников: повторный импорт того же расписания
    // не должен завести вторую серию на тот же день и час.
    const active = await this.prisma.lessonSeries.findMany({
      where: { tutorId, studentId: { in: studentIds }, endsAt: null },
      select: { studentId: true, startsAt: true },
    })

    const until = horizonFrom(new Date())
    const created: LessonView[] = []
    let skipped = 0

    for (const item of dto.series) {
      const first = new Date(item.startsAt)
      if (active.some((s) => s.studentId === item.studentId && sameWeeklySlot(s.startsAt, first, timezone))) {
        skipped += 1
        continue
      }
      active.push({ studentId: item.studentId, startsAt: first })

      const dates = seriesOccurrences(first, null, until, timezone)
      const series = await this.prisma.lessonSeries.create({
        data: {
          tutorId,
          studentId: item.studentId,
          startsAt: first,
          duration: item.duration ?? 60,
          // Первое занятие за горизонтом — отметка чуть раньше него,
          // чтобы продление создало его, когда подойдёт срок.
          generatedUntil: dates.at(-1) ?? new Date(first.getTime() - 1),
        },
        select: { id: true, studentId: true, duration: true },
      })
      created.push(...(await this.generate(tutorId, series, priceOf.get(item.studentId)!, dates)))
    }

    return { created, skipped }
  }

  /**
   * Обрывает серию: с момента from занятий больше нет.
   *
   * Удаляются только запланированные занятия: проведённые и отменённые —
   * уже история, в том числе денежная.
   */
  async stop(tutorId: string, id: string, from: Date): Promise<{ deletedIds: string[] }> {
    const series = await this.prisma.lessonSeries.findFirst({ where: { id, tutorId }, select: { id: true } })
    if (!series) throw new NotFoundException('Серия занятий не найдена')

    const doomed = await this.prisma.lesson.findMany({
      where: { seriesId: id, status: 'PLANNED', startsAt: { gte: from } },
      select: { id: true },
    })
    const deletedIds = doomed.map((l) => l.id)

    await this.prisma.$transaction([
      this.prisma.lessonSeries.update({ where: { id }, data: { endsAt: from } }),
      this.prisma.lesson.deleteMany({ where: { id: { in: deletedIds } } }),
    ])
    return { deletedIds }
  }

  /**
   * Раз в час продлевает серии, у которых созданные занятия подходят
   * к концу. Не раз в сутки: на хостинге, который усыпляет приложение,
   * единственный ночной запуск легко пропустить.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async extendAll(now = new Date()): Promise<void> {
    if (this.extending) return
    this.extending = true
    try {
      const until = horizonFrom(now)
      const due = await this.prisma.lessonSeries.findMany({
        where: {
          endsAt: null,
          // Следующее занятие — через неделю после отметки; час запаса на перевод часов
          generatedUntil: { lte: new Date(until.getTime() - 7 * 24 * 3_600_000 + 3_600_000) },
          // В архиве ученик не занимается; вернётся — серия продолжится
          student: { archivedAt: null },
        },
        select: {
          id: true,
          tutorId: true,
          studentId: true,
          startsAt: true,
          duration: true,
          generatedUntil: true,
          student: { select: { price: true } },
          tutor: { select: { user: { select: { timezone: true } } } },
        },
      })

      for (const series of due) {
        // Не раньше «сейчас»: серия ученика, вернувшегося из архива,
        // не должна заполнить пропущенные месяцы задним числом.
        const after = series.generatedUntil > now ? series.generatedUntil : now
        const dates = seriesOccurrences(series.startsAt, after, until, series.tutor.user.timezone)
        if (dates.length === 0) continue
        await this.generate(series.tutorId, series, series.student.price, dates)
        await this.prisma.lessonSeries.update({
          where: { id: series.id },
          data: { generatedUntil: dates.at(-1) },
        })
      }
    } catch (e) {
      // Cron не должен умолкнуть навсегда из-за одной ошибки.
      this.logger.error(`Сбой продления серий: ${(e as Error).message}`)
    } finally {
      this.extending = false
    }
  }

  /** Создаёт занятия серии на даты dates, пропуская уже занятые этим учеником. */
  private async generate(
    tutorId: string,
    series: { id: string; studentId: string; duration: number },
    price: number,
    dates: Date[],
  ): Promise<LessonView[]> {
    if (dates.length === 0) return []

    const existing = await this.prisma.lesson.findMany({
      where: {
        tutorId,
        studentId: series.studentId,
        startsAt: { in: dates },
        // На месте отменённого занятия новое ставить можно
        status: { not: 'CANCELLED' },
      },
      select: { startsAt: true },
    })
    const taken = new Set(existing.map((l) => l.startsAt.getTime()))

    const data: Prisma.LessonCreateManyInput[] = dates
      .filter((at) => !taken.has(at.getTime()))
      .map((startsAt) => ({
        tutorId,
        studentId: series.studentId,
        seriesId: series.id,
        startsAt,
        duration: series.duration,
        // Цена ученика на день создания занятия: поднятая цена дойдёт
        // до занятий, которые серия создаст позже, и не тронет уже созданные.
        price,
      }))
    if (data.length === 0) return []

    const created = await this.prisma.lesson.createManyAndReturn({ data, select: LESSON_SELECT })
    for (const lesson of created) {
      try {
        await this.reminders.planForLesson(lesson.id)
      } catch (e) {
        this.logger.error(`Не удалось запланировать напоминания: ${(e as Error).message}`)
      }
    }
    return created
  }
}
