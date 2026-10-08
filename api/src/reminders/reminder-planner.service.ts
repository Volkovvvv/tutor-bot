import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { planReminders } from './schedule'

/**
 * Планирование напоминаний: когда и какие записи Reminder создать.
 *
 * Отдельно от RemindersService: тот шлёт через бота, а планировать нужно
 * и из приглашений, которыми бот сам пользуется, — вместе вышел бы цикл.
 */
@Injectable()
export class ReminderPlanner {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создаёт записи напоминаний для занятия.
   *
   * Идемпотентна: @@unique([lessonId, kind]) не даст создать дубль,
   * а skipDuplicates превращает повторный вызов в пустую операцию.
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
              select: { enabled: true, beforeHours: true, beforeMinutes: true, quietFrom: true, quietTo: true },
            },
            tutor: { select: { user: { select: { timezone: true } } } },
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

    const planned = planReminders(lesson.startsAt, notify, now, lesson.student.tutor.user.timezone)
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
      // Отметку о долге не трогаем: она не про время занятия
      where: { lessonId, sentAt: null, kind: { not: 'DEBT' } },
    })
    await this.planForLesson(lessonId, now)
  }

  /**
   * Пересоздаёт напоминания всех будущих занятий ученика.
   *
   * Нужна, когда меняется не занятие, а сам ученик: подключился к боту,
   * вернулся из архива или репетитор поменял ему настройки напоминаний.
   */
  async replanForStudent(studentId: string, now = new Date()): Promise<void> {
    const lessons = await this.prisma.lesson.findMany({
      where: { studentId, status: 'PLANNED', startsAt: { gt: now } },
      select: { id: true },
    })
    for (const { id } of lessons) await this.replanForLesson(id, now)
  }

  /**
   * Пересоздаёт напоминания всех будущих занятий репетитора.
   *
   * Нужна при смене его таймзоны: тихие часы считаются в ней,
   * и прежние времена отправки могли прийтись на ночь.
   */
  async replanForTutor(tutorId: string, now = new Date()): Promise<void> {
    const lessons = await this.prisma.lesson.findMany({
      where: { tutorId, status: 'PLANNED', startsAt: { gt: now } },
      select: { id: true },
    })
    for (const { id } of lessons) await this.replanForLesson(id, now)
  }
}
