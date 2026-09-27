import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { generateInviteCode, isValidInviteCodeFormat } from './invite-code'

/** Срок жизни приглашения. */
const INVITE_TTL_HOURS = 72

export interface InviteView {
  code: string
  link: string
  expiresAt: Date
  /** Готовый текст для отправки ученику. */
  message: string
}

/** Результат привязки ученика к боту — для нужд бота, не для API. */
export interface AcceptResult {
  studentId: string
  studentName: string
  tutorName: string
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name)
  private readonly botUsername: string

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Убираем @, если он попал в переменную: иначе ссылка
    // t.me/@bot ведёт в никуда.
    this.botUsername = (config.get<string>('BOT_USERNAME') ?? '').replace(/^@/, '')
  }

  /**
   * Создаёт приглашение для ученика.
   *
   * Старые неиспользованные коды гасятся: иначе у одного ученика
   * накапливается набор действующих ссылок, каждая из которых — secret.
   */
  async create(tutorId: string, studentId: string): Promise<InviteView> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tutorId },
      select: {
        id: true,
        name: true,
        userId: true,
        archivedAt: true,
        tutor: { select: { user: { select: { firstName: true } } } },
      },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    if (student.archivedAt) {
      throw new ConflictException('Ученик в архиве — восстановите карточку')
    }
    if (student.userId) {
      throw new ConflictException('Ученик уже подключён к боту')
    }

    const code = generateInviteCode()
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000)

    await this.prisma.$transaction([
      // Гасим прошлые неиспользованные приглашения этого ученика.
      this.prisma.invite.updateMany({
        where: { studentId, usedAt: null },
        data: { expiresAt: new Date(0) },
      }),
      this.prisma.invite.create({ data: { code, studentId, expiresAt } }),
      this.prisma.student.update({
        where: { id: studentId },
        data: { inviteStatus: 'INVITED' },
      }),
    ])

    return {
      code,
      link: this.link(code),
      expiresAt,
      message: this.message(student.name, code),
    }
  }

  /**
   * Привязывает аккаунт Telegram к карточке ученика по коду из /start.
   *
   * Вызывается ботом, то есть по данным от произвольного человека
   * в Telegram. Возвращает null при любой проблеме: бот отвечает
   * одинаково во всех случаях, чтобы по ответу нельзя было отличить
   * «кода нет» от «код уже использован» и подбирать ссылки.
   */
  async accept(
    rawCode: string,
    tg: { id: number; firstName: string; lastName?: string; username?: string; photoUrl?: string },
  ): Promise<AcceptResult | null> {
    // Форма проверяется до базы: в /start прилетает что угодно.
    if (!isValidInviteCodeFormat(rawCode)) {
      this.logger.warn('Отклонён /start: некорректная форма кода')
      return null
    }

    const invite = await this.prisma.invite.findUnique({
      where: { code: rawCode },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        student: {
          select: {
            id: true,
            name: true,
            userId: true,
            archivedAt: true,
            tutor: { select: { user: { select: { firstName: true } } } },
          },
        },
      },
    })

    if (!invite) {
      this.logger.warn('Отклонён /start: код не найден')
      return null
    }
    // Одноразовость: повторное использование кода не привяжет
    // второго человека к той же карточке.
    if (invite.usedAt) {
      this.logger.warn('Отклонён /start: код уже использован')
      return null
    }
    if (invite.expiresAt <= new Date()) {
      this.logger.warn('Отклонён /start: код просрочен')
      return null
    }
    if (invite.student.archivedAt) {
      this.logger.warn('Отклонён /start: ученик в архиве')
      return null
    }
    if (invite.student.userId) {
      this.logger.warn('Отклонён /start: карточка уже занята')
      return null
    }

    // Аккаунт ученика, карточка и гашение кода — одной транзакцией.
    // Иначе сбой посередине оставил бы код использованным,
    // но ученика неподключённым.
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { tgId: BigInt(tg.id) },
          update: {
            firstName: tg.firstName,
            lastName: tg.lastName ?? null,
            username: tg.username ?? null,
            photoUrl: tg.photoUrl ?? null,
          },
          create: {
            tgId: BigInt(tg.id),
            firstName: tg.firstName,
            lastName: tg.lastName ?? null,
            username: tg.username ?? null,
            photoUrl: tg.photoUrl ?? null,
          },
        })

        await tx.student.update({
          where: { id: invite.student.id },
          data: {
            userId: user.id,
            inviteStatus: 'ACCEPTED',
            source: 'TELEGRAM',
          },
        })

        // updateMany с условием usedAt: null — это защита от гонки.
        // Два одновременных /start с одним кодом: второй получит
        // count 0 и откатит транзакцию.
        const used = await tx.invite.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedAt: new Date() },
        })
        if (used.count === 0) {
          throw new ConflictException('Код уже использован')
        }
      })
    } catch (e) {
      // Сюда же попадает нарушение @@unique([tutorId, userId]):
      // человек уже заведён у этого репетитора другой карточкой.
      this.logger.warn(`Не удалось привязать ученика: ${(e as Error).message}`)
      return null
    }

    return {
      studentId: invite.student.id,
      studentName: invite.student.name,
      tutorName: invite.student.tutor.user.firstName,
    }
  }

  /** Отзыв приглашения: ссылка перестаёт работать сразу. */
  async revoke(tutorId: string, studentId: string): Promise<{ revoked: number }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tutorId },
      select: { id: true },
    })
    if (!student) throw new NotFoundException('Ученик не найден')

    const result = await this.prisma.$transaction([
      this.prisma.invite.updateMany({
        where: { studentId, usedAt: null },
        data: { expiresAt: new Date(0) },
      }),
      this.prisma.student.updateMany({
        // Статус откатываем только если ученик ещё не подключился.
        where: { id: studentId, inviteStatus: 'INVITED' },
        data: { inviteStatus: 'NONE' },
      }),
    ])

    return { revoked: result[0].count }
  }

  private link(code: string): string {
    return `https://t.me/${this.botUsername}?start=${code}`
  }

  private message(studentName: string, code: string): string {
    return (
      `${studentName}, привет! Я буду присылать напоминания о занятиях через бота.\n\n` +
      `Нажмите ссылку и кнопку «Начать» — этого достаточно:\n${this.link(code)}`
    )
  }
}
