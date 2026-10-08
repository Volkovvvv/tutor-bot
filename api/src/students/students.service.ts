import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ReminderPlanner } from '../reminders/reminder-planner.service'
import { TutorsService } from '../tutors/tutors.service'
import type { CreateStudentDto } from './dto/create-student.dto'
import type { ListStudentsDto } from './dto/list-students.dto'
import type { UpdateNotifySettingsDto } from './dto/notify-settings.dto'
import type { UpdateStudentDto } from './dto/update-student.dto'

/**
 * Поля, которые уходят клиенту.
 *
 * Явный select вместо «отдать всю строку»: так новое внутреннее поле
 * в схеме не утечёт в API само по себе. В частности, наружу не идёт
 * userId — внутренняя связь с аккаунтом Telegram.
 */
const STUDENT_SELECT = {
  id: true,
  name: true,
  price: true,
  note: true,
  grade: true,
  source: true,
  inviteStatus: true,
  archivedAt: true,
  createdAt: true,
  notify: {
    select: {
      enabled: true,
      beforeHours: true,
      beforeMinutes: true,
      debtReminder: true,
      quietFrom: true,
      quietTo: true,
    },
  },
} satisfies Prisma.StudentSelect

export type StudentView = Prisma.StudentGetPayload<{ select: typeof STUDENT_SELECT }>

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly tutors: TutorsService,
    private readonly reminders: ReminderPlanner,
  ) {}

  /**
   * Каждый метод принимает tutorId первым аргументом и подставляет его
   * в where. Это единственная защита от того, чтобы подстановка чужого
   * UUID в URL отдала чужого ученика — забыть её нельзя, потому что
   * без неё запрос просто не собирается.
   */

  async list(tutorId: string, query: ListStudentsDto): Promise<StudentView[]> {
    return this.prisma.student.findMany({
      where: {
        tutorId,
        ...(query.includeArchived ? {} : { archivedAt: null }),
      },
      select: STUDENT_SELECT,
      orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip: query.skip ?? 0,
      take: query.take ?? 100,
    })
  }

  async findOne(tutorId: string, id: string): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      // Не findUnique по id: без tutorId в условии чужая карточка
      // нашлась бы и вернулась клиенту.
      where: { id, tutorId },
      select: STUDENT_SELECT,
    })
    // Чужой ученик и несуществующий дают одинаковый 404:
    // разница в ответах позволила бы перебором узнать, какие id существуют.
    if (!student) throw new NotFoundException('Ученик не найден')
    return student
  }

  async create(tutorId: string, dto: CreateStudentDto): Promise<StudentView> {
    // Напоминания по умолчанию — из профиля репетитора (онбординг),
    // явно переданные в запросе поля важнее
    const notify = { ...(await this.tutors.notifyDefaults(tutorId)), ...dto.notify }

    return this.prisma.student.create({
      data: {
        tutorId,
        name: dto.name.trim(),
        price: dto.price,
        note: dto.note?.trim() ?? null,
        grade: dto.grade ?? null,
        // Настройки создаём всегда: планировщику проще читать строку
        // с дефолтами, чем обрабатывать их отсутствие.
        notify: { create: notify },
      },
      select: STUDENT_SELECT,
    })
  }

  async update(tutorId: string, id: string, dto: UpdateStudentDto): Promise<StudentView> {
    await this.assertOwned(tutorId, id)

    return this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() ?? null } : {}),
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
      },
      select: STUDENT_SELECT,
    })
  }

  async updateNotify(
    tutorId: string,
    id: string,
    dto: UpdateNotifySettingsDto,
  ): Promise<StudentView> {
    await this.assertOwned(tutorId, id)

    await this.prisma.notifySettings.upsert({
      where: { studentId: id },
      update: dto,
      create: { studentId: id, ...dto },
    })
    // Новые настройки должны действовать и на уже поставленные занятия
    await this.safeReplan(id)

    return this.findOne(tutorId, id)
  }

  /**
   * Архивация вместо удаления: вместе с карточкой иначе пропадает
   * вся финансовая история за год.
   */
  async archive(tutorId: string, id: string): Promise<StudentView> {
    await this.assertOwned(tutorId, id)

    return this.prisma.student.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: STUDENT_SELECT,
    })
  }

  async restore(tutorId: string, id: string): Promise<StudentView> {
    await this.assertOwned(tutorId, id)

    const student = await this.prisma.student.update({
      where: { id },
      data: { archivedAt: null },
      select: STUDENT_SELECT,
    })
    await this.safeReplan(id)
    return student
  }

  /** Напоминания — вторичный эффект: их сбой не должен ронять правку карточки. */
  private async safeReplan(studentId: string): Promise<void> {
    try {
      await this.reminders.replanForStudent(studentId)
    } catch (e) {
      this.logger.error(`Не удалось перепланировать напоминания ученика: ${(e as Error).message}`)
    }
  }

  /**
   * Удаление насовсем, вместе с занятиями, сериями и материалами уроков
   * (каскад в схеме). Архивация в приложении не используется: репетитору
   * нужна одна понятная кнопка, а о потере истории его предупреждает экран.
   */
  async remove(tutorId: string, id: string): Promise<{ deleted: true }> {
    await this.assertOwned(tutorId, id)
    await this.prisma.student.delete({ where: { id } })
    return { deleted: true }
  }

  /** Проверяет, что карточка принадлежит этому репетитору. */
  private async assertOwned(tutorId: string, id: string): Promise<void> {
    const found = await this.prisma.student.findFirst({
      where: { id, tutorId },
      select: { id: true },
    })
    if (!found) throw new NotFoundException('Ученик не найден')
  }
}
