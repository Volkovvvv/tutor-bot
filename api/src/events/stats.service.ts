import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { buildStats, formatStats, formatTimeline, type StatEvent } from './stats'

const DAY = 24 * 3_600_000
// Пилот — десятки репетиторов и тысячи событий; потолок — страховка от того дня,
// когда журнал вырастет, а сводка всё ещё читает его целиком.
const EVENTS_CAP = 50_000
const TIMELINE = 40

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(now = new Date()): Promise<string> {
    const seen = (since: Date) =>
      this.prisma.user.count({ where: { tutorProfile: { isNot: null }, lastSeenAt: { gte: since } } })

    const [tutors, seen24h, seen7d, rows] = await Promise.all([
      this.prisma.tutor.count(),
      seen(new Date(now.getTime() - DAY)),
      seen(new Date(now.getTime() - 7 * DAY)),
      this.prisma.event.findMany({
        select: { tutorId: true, name: true, props: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: EVENTS_CAP,
      }),
    ])
    return formatStats(buildStats({ events: rows.map(toStatEvent), tutors, seen24h, seen7d }))
  }

  /**
   * Сбрасывает отметку «прошёл знакомство» у кабинета с этим Telegram ID:
   * при следующем открытии приложение снова покажет онбординг. Нужно
   * администратору, чтобы пересмотреть знакомство глазами нового репетитора.
   * Предметы, цена и ученики остаются. false — кабинета нет.
   */
  async resetOnboarding(tgId: number): Promise<boolean> {
    const { count } = await this.prisma.tutor.updateMany({
      where: { user: { tgId: BigInt(tgId) } },
      data: { onboardedAt: null },
    })
    return count > 0
  }

  /** Что делал один репетитор; null — такого пользователя нет. */
  async timeline(username: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, tutorProfile: { isNot: null } },
      select: { firstName: true, lastSeenAt: true, tutorProfile: { select: { id: true } } },
    })
    if (!user?.tutorProfile) return null

    const rows = await this.prisma.event.findMany({
      where: { tutorId: user.tutorProfile.id },
      select: { tutorId: true, name: true, props: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: TIMELINE,
    })
    const seen = user.lastSeenAt
      ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(
          user.lastSeenAt,
        )
      : 'ни разу'
    return formatTimeline(`${user.firstName} (@${username}) · заходил: ${seen}`, rows.map(toStatEvent))
  }
}

function toStatEvent(row: {
  tutorId: string
  name: string
  props: Prisma.JsonValue
  createdAt: Date
}): StatEvent {
  const props = row.props && typeof row.props === 'object' && !Array.isArray(row.props) ? row.props : {}
  return { tutorId: row.tutorId, name: row.name, props: props as Record<string, unknown>, createdAt: row.createdAt }
}
