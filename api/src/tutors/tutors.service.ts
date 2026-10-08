import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { UpdateTutorDto } from './dto/update-tutor.dto'

const TUTOR_SELECT = {
  displayName: true,
  subjects: true,
  defaultPrice: true,
  country: true,
  notifyBeforeHours: true,
  notifyBeforeMinutes: true,
  notifyDebtReminder: true,
  onboardedAt: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.TutorSelect

type TutorRow = Prisma.TutorGetPayload<{ select: typeof TUTOR_SELECT }>

/** Профиль кабинета, как его видит мини-апп. Деньги — копейки. */
export interface TutorView {
  displayName: string | null
  /** Имя из Telegram — подсказка, пока displayName не задан. */
  telegramName: string
  subjects: string[]
  defaultPrice: number | null
  country: 'RU' | 'BY'
  notifyBeforeHours: number
  notifyBeforeMinutes: number
  notifyDebtReminder: boolean
  onboardedAt: Date | null
}

function toView(row: TutorRow): TutorView {
  const { user, ...profile } = row
  return {
    ...profile,
    telegramName: [user.firstName, user.lastName].filter(Boolean).join(' '),
  }
}

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tutorId: string): Promise<TutorView> {
    const row = await this.prisma.tutor.findUnique({ where: { id: tutorId }, select: TUTOR_SELECT })
    if (!row) throw new NotFoundException('Кабинет не найден')
    return toView(row)
  }

  async update(tutorId: string, dto: UpdateTutorDto): Promise<TutorView> {
    const { onboarded, displayName, subjects, ...rest } = dto
    // Дата фиксирует первое прохождение: повторный onboarded: true её не сдвигает
    const onboardedAt = onboarded ? ((await this.onboardedAt(tutorId)) ?? new Date()) : undefined

    const row = await this.prisma.tutor.update({
      where: { id: tutorId },
      data: {
        ...rest,
        ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
        // Пустые и повторяющиеся предметы отбрасываем, порядок выбора сохраняем
        ...(subjects !== undefined
          ? { subjects: [...new Set(subjects.map((s) => s.trim()).filter(Boolean))] }
          : {}),
        ...(onboardedAt ? { onboardedAt } : {}),
      },
      select: TUTOR_SELECT,
    })
    return toView(row)
  }

  /** Настройки напоминаний для новой карточки ученика. */
  async notifyDefaults(tutorId: string) {
    const t = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      select: { notifyBeforeHours: true, notifyBeforeMinutes: true, notifyDebtReminder: true },
    })
    if (!t) return {}
    // Напоминание о долге пока не рассылается, поэтому на «включено» не влияет
    const any = t.notifyBeforeHours > 0 || t.notifyBeforeMinutes > 0
    return {
      enabled: any,
      beforeHours: t.notifyBeforeHours,
      beforeMinutes: t.notifyBeforeMinutes,
      debtReminder: t.notifyDebtReminder,
    }
  }

  private async onboardedAt(tutorId: string): Promise<Date | null> {
    const t = await this.prisma.tutor.findUnique({ where: { id: tutorId }, select: { onboardedAt: true } })
    return t?.onboardedAt ?? null
  }
}
