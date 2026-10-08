import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { ReminderPlanner } from '../reminders/reminder-planner.service'
import { InitDataError, verifyInitData } from '../telegram/init-data'
import type { JwtPayload } from './auth.types'

/** Что получает мини-апп после входа. */
export interface LoginResult {
  accessToken: string
  user: {
    id: string
    firstName: string
    lastName: string | null
    username: string | null
    photoUrl: string | null
    timezone: string
  }
  tutorId: string
}

/** Таймзона от клиента — только если её знает Intl; иначе остаётся прежняя. */
function validTimezone(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone: raw })
    return raw
  } catch {
    return null
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly botToken: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly reminders: ReminderPlanner,
    config: ConfigService,
  ) {
    this.botToken = config.getOrThrow<string>('BOT_TOKEN')
  }

  /**
   * Вход по initData: проверяем подпись, находим или создаём кабинет,
   * выдаём JWT.
   *
   * Подпись проверяется до любого обращения к базе: неаутентифицированный
   * запрос не должен уметь даже создавать строки.
   */
  async login(initDataRaw: string, timezoneRaw?: string): Promise<LoginResult> {
    let data
    try {
      data = verifyInitData(initDataRaw, this.botToken)
    } catch (e) {
      if (e instanceof InitDataError) {
        // Причину в лог, клиенту — обобщённо: подробности о том, что именно
        // не сошлось, помогают подбирать подпись.
        this.logger.warn(`Отклонён вход: ${e.message}`)
        throw new UnauthorizedException('Некорректные данные авторизации Telegram')
      }
      throw e
    }

    const tg = data.user
    const timezone = validTimezone(timezoneRaw)

    // Транзакция: пользователь и кабинет создаются вместе либо никак.
    const { user, tutor, zoneChanged } = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { tgId: BigInt(tg.id) }, select: { timezone: true } })
      const user = await tx.user.upsert({
        where: { tgId: BigInt(tg.id) },
        // Профиль в Telegram мог измениться с прошлого входа.
        update: {
          firstName: tg.firstName,
          lastName: tg.lastName ?? null,
          username: tg.username ?? null,
          photoUrl: tg.photoUrl ?? null,
          ...(timezone ? { timezone } : {}),
        },
        create: {
          tgId: BigInt(tg.id),
          firstName: tg.firstName,
          lastName: tg.lastName ?? null,
          username: tg.username ?? null,
          photoUrl: tg.photoUrl ?? null,
          ...(timezone ? { timezone } : {}),
        },
      })

      // Кабинет репетитора создаётся при первом входе.
      // Открыл мини-апп — значит собирается вести учёт.
      const tutor = await tx.tutor.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      })

      return { user, tutor, zoneChanged: before !== null && before.timezone !== user.timezone }
    })

    // Тихие часы считаются в таймзоне репетитора: сменилась — уже запланированные
    // напоминания могли прийтись на ночь. Вход этого не ждёт.
    if (zoneChanged) {
      void this.reminders
        .replanForTutor(tutor.id)
        .catch((e: Error) => this.logger.error(`Напоминания после смены таймзоны не перепланированы: ${e.message}`))
    }

    const payload: JwtPayload = { sub: user.id, tid: tutor.id }

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
        timezone: user.timezone,
      },
      // tgId наружу не отдаём: клиент и так знает свой Telegram ID,
      // а в нашем API он не нужен ни для одного запроса.
      tutorId: tutor.id,
    }
  }
}
