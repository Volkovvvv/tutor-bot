import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Prisma } from '@prisma/client'
import { importsLimit, materialsLimit } from '../materials/material-content'
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
  materialsGenerated: true,
  scheduleImports: true,
  user: { select: { firstName: true, lastName: true, tgId: true } },
} satisfies Prisma.TutorSelect

type TutorRow = Prisma.TutorGetPayload<{ select: typeof TUTOR_SELECT }>

/** Расход пробного лимита; limit: null — без лимита. */
export interface Quota {
  used: number
  limit: number | null
}

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
  /** Счётчики пробных лимитов ИИ — приложение показывает, сколько осталось. */
  limits: { materials: Quota; imports: Quota }
}

@Injectable()
export class TutorsService {
  private readonly materialsLimit: number | null
  private readonly importsLimit: number | null
  /** Администратору лимиты не считаются (см. MaterialsService). */
  private readonly adminTgId: string | null

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.materialsLimit = materialsLimit(config.get('AI_MATERIALS_LIMIT'))
    this.importsLimit = importsLimit(config.get('AI_IMPORTS_LIMIT'))
    this.adminTgId = String(config.get('ADMIN_TG_ID') ?? '').trim() || null
  }

  private toView(row: TutorRow): TutorView {
    const { user, materialsGenerated, scheduleImports, ...profile } = row
    const isAdmin = this.adminTgId !== null && String(user.tgId) === this.adminTgId
    return {
      ...profile,
      telegramName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      limits: {
        materials: { used: materialsGenerated, limit: isAdmin ? null : this.materialsLimit },
        imports: { used: scheduleImports, limit: isAdmin ? null : this.importsLimit },
      },
    }
  }

  async get(tutorId: string): Promise<TutorView> {
    const row = await this.prisma.tutor.findUnique({ where: { id: tutorId }, select: TUTOR_SELECT })
    if (!row) throw new NotFoundException('Кабинет не найден')
    return this.toView(row)
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
    return this.toView(row)
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
