import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { type Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ReminderPlanner } from '../reminders/reminder-planner.service'
import type { CreateLessonDto } from './dto/create-lesson.dto'
import type { BulkLessonsDto } from './dto/import-schedule.dto'
import type { ListLessonsDto } from './dto/list-lessons.dto'
import type { SummaryQueryDto } from './dto/summary.dto'
import type { UpdateLessonDto } from './dto/update-lesson.dto'

export const LESSON_SELECT = {
  id: true,
  studentId: true,
  startsAt: true,
  duration: true,
  price: true,
  status: true,
  paidAt: true,
  note: true,
  seriesId: true,
  createdAt: true,
  student: { select: { id: true, name: true } },
} satisfies Prisma.LessonSelect

export type LessonView = Prisma.LessonGetPayload<{ select: typeof LESSON_SELECT }>

/** Итоги за период. Все суммы — копейки. */
export interface LessonsSummary {
  from: Date
  to: Date
  /** Проведённые занятия. */
  doneCount: number
  /** Запланированные в периоде. */
  plannedCount: number
  /** Получено: проведённые и оплаченные. */
  earned: number
  /** Долг: проведённые, но не оплаченные. */
  owed: number
}

/**
 * Границы периода: переданные клиентом или текущий календарный месяц.
 *
 * Месяц считается по UTC. Для отчёта «сколько заработал» сдвиг границы
 * на несколько часов не важен, а таймзона репетитора понадобится
 * планировщику — там она и учитывается.
 */
function monthBounds(query: SummaryQueryDto): { from: Date; to: Date } {
  if (query.from && query.to) {
    const from = new Date(query.from)
    const to = new Date(query.to)
    if (to <= from) {
      throw new BadRequestException('Конец периода должен быть позже начала')
    }
    return { from, to }
  }

  const now = new Date()
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: ReminderPlanner,
  ) {}

  async list(tutorId: string, query: ListLessonsDto): Promise<LessonView[]> {
    const range: Prisma.DateTimeFilter = {}
    if (query.from) range.gte = new Date(query.from)
    if (query.to) range.lt = new Date(query.to)

    return this.prisma.lesson.findMany({
      where: {
        tutorId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to ? { startsAt: range } : {}),
      },
      select: LESSON_SELECT,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      skip: query.skip ?? 0,
      take: query.take ?? 100,
    })
  }

  async findOne(tutorId: string, id: string): Promise<LessonView> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, tutorId },
      select: LESSON_SELECT,
    })
    if (!lesson) throw new NotFoundException('Занятие не найдено')
    return lesson
  }

  async create(tutorId: string, dto: CreateLessonDto): Promise<LessonView> {
    // Ученик обязан принадлежать этому же репетитору. Без этой проверки
    // подстановка чужого studentId создала бы занятие в чужом кабинете.
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tutorId },
      select: { id: true, price: true, archivedAt: true },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    if (student.archivedAt) {
      throw new BadRequestException('Ученик в архиве — восстановите карточку')
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        tutorId,
        studentId: student.id,
        startsAt: new Date(dto.startsAt),
        duration: dto.duration ?? 60,
        // Снимок цены на момент создания. Если брать её из Student
        // при чтении, поднятие цены переписало бы все прошлые месяцы.
        price: dto.price ?? student.price,
        note: dto.note?.trim() ?? null,
      },
      select: LESSON_SELECT,
    })

    // Напоминания планируются сразу. Сбой здесь не должен отменять
    // созданное занятие: репетитор его уже видит в расписании.
    await this.safePlan(lesson.id)

    return lesson
  }

  /**
   * Создаёт сразу много занятий — расписание на недели вперёд.
   *
   * Повторный импорт того же расписания не должен удваивать занятия:
   * те, что у ученика уже стоят на это же время, пропускаются.
   */
  async createMany(tutorId: string, dto: BulkLessonsDto): Promise<{ created: LessonView[]; skipped: number }> {
    const studentIds = [...new Set(dto.lessons.map((l) => l.studentId))]
    // Та же проверка, что в create: все ученики — этого репетитора.
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, tutorId },
      select: { id: true, price: true, archivedAt: true },
    })
    if (students.length !== studentIds.length) throw new NotFoundException('Ученик не найден')
    if (students.some((s) => s.archivedAt)) {
      throw new BadRequestException('Ученик в архиве — восстановите карточку')
    }
    const priceOf = new Map(students.map((s) => [s.id, s.price]))

    const key = (studentId: string, startsAt: Date) => `${studentId}|${startsAt.getTime()}`
    const existing = await this.prisma.lesson.findMany({
      where: {
        tutorId,
        studentId: { in: studentIds },
        startsAt: { in: dto.lessons.map((l) => new Date(l.startsAt)) },
        // На месте отменённого занятия новое ставить можно
        status: { not: 'CANCELLED' },
      },
      select: { studentId: true, startsAt: true },
    })
    const taken = new Set(existing.map((l) => key(l.studentId, l.startsAt)))

    const data: Prisma.LessonCreateManyInput[] = []
    for (const l of dto.lessons) {
      const startsAt = new Date(l.startsAt)
      const k = key(l.studentId, startsAt)
      if (taken.has(k)) continue
      // Заодно отсекает повторы внутри самого запроса
      taken.add(k)
      data.push({
        tutorId,
        studentId: l.studentId,
        startsAt,
        duration: l.duration ?? 60,
        price: l.price ?? priceOf.get(l.studentId)!,
        note: l.note?.trim() ?? null,
      })
    }

    const skipped = dto.lessons.length - data.length
    if (data.length === 0) return { created: [], skipped }

    const created = await this.prisma.lesson.createManyAndReturn({ data, select: LESSON_SELECT })
    for (const lesson of created) await this.safePlan(lesson.id)

    return { created, skipped }
  }

  async update(tutorId: string, id: string, dto: UpdateLessonDto): Promise<LessonView> {
    const current = await this.prisma.lesson.findFirst({
      where: { id, tutorId },
      select: { id: true, paidAt: true },
    })
    if (!current) throw new NotFoundException('Занятие не найдено')

    const data: Prisma.LessonUpdateInput = {}
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt)
    if (dto.duration !== undefined) data.duration = dto.duration
    if (dto.price !== undefined) data.price = dto.price
    if (dto.status !== undefined) data.status = dto.status
    if (dto.note !== undefined) data.note = dto.note?.trim() ?? null

    if (dto.paid !== undefined) {
      // Время оплаты ставит сервер. Повторное «оплачено» не сдвигает
      // уже записанную дату — иначе отчёт за прошлый месяц поехал бы.
      data.paidAt = dto.paid ? (current.paidAt ?? new Date()) : null
    }

    const lesson = await this.prisma.lesson.update({
      where: { id },
      data,
      select: LESSON_SELECT,
    })

    // Время или статус изменились — прежние времена отправки неверны.
    // Правка цены или заметки напоминаний не касается.
    if (dto.startsAt !== undefined || dto.status !== undefined) {
      await this.safeReplan(lesson.id)
    }

    return lesson
  }

  /**
   * Итоги за период. Считает база, а не JS: тянуть все занятия
   * в приложение ради суммы — лишний трафик и лишняя память.
   */
  async summary(tutorId: string, query: SummaryQueryDto): Promise<LessonsSummary> {
    const { from, to } = monthBounds(query)
    const period = { tutorId, startsAt: { gte: from, lt: to } }

    // Четыре точных агрегата вместо groupBy по paidAt: группировка
    // по дате оплаты вернула бы строку на каждый день, и суммировать
    // их пришлось бы в JS без всякой пользы.
    const [earned, owed, doneCount, plannedCount] = await Promise.all([
      // Получено: проведённые и оплаченные.
      this.prisma.lesson.aggregate({
        where: { ...period, status: 'DONE', paidAt: { not: null } },
        _sum: { price: true },
      }),
      // Долг: проведённые без оплаты.
      this.prisma.lesson.aggregate({
        where: { ...period, status: 'DONE', paidAt: null },
        _sum: { price: true },
      }),
      this.prisma.lesson.count({ where: { ...period, status: 'DONE' } }),
      this.prisma.lesson.count({ where: { ...period, status: 'PLANNED' } }),
    ])

    return {
      from,
      to,
      doneCount,
      plannedCount,
      // Отменённые занятия не попадают ни в одну сумму.
      earned: earned._sum.price ?? 0,
      owed: owed._sum.price ?? 0,
    }
  }

  /**
   * Планирование напоминаний не должно ронять запрос: занятие создано
   * и сохранено, а напоминание — вторичный эффект, который к тому же
   * восстановится при следующей правке занятия.
   */
  private async safePlan(lessonId: string): Promise<void> {
    try {
      await this.reminders.planForLesson(lessonId)
    } catch (e) {
      this.logger.error(`Не удалось запланировать напоминания: ${(e as Error).message}`)
    }
  }

  private async safeReplan(lessonId: string): Promise<void> {
    try {
      await this.reminders.replanForLesson(lessonId)
    } catch (e) {
      this.logger.error(`Не удалось перепланировать напоминания: ${(e as Error).message}`)
    }
  }

  async remove(tutorId: string, id: string): Promise<{ deleted: true }> {
    const found = await this.prisma.lesson.findFirst({
      where: { id, tutorId },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Занятие не найдено')

    // Занятия удаляются полностью: в отличие от ученика, у занятия
    // нет связанной истории, которую можно потерять.
    await this.prisma.lesson.delete({ where: { id } })
    return { deleted: true }
  }
}
