import { ReminderKind } from '@prisma/client'
import { planReminders } from './schedule'

const notify = (over: Partial<Parameters<typeof planReminders>[1]> = {}) => ({
  enabled: true,
  beforeHours: 24,
  beforeMinutes: 60,
  ...over,
})

const NOW = new Date('2026-10-01T10:00:00Z')
const kinds = (r: ReturnType<typeof planReminders>) => r.map((x) => x.kind)

describe('planReminders', () => {
  it('планирует два напоминания для занятия в будущем', () => {
    const startsAt = new Date('2026-10-05T13:00:00Z')
    const result = planReminders(startsAt, notify(), NOW)

    expect(kinds(result)).toEqual([ReminderKind.BEFORE_HOURS, ReminderKind.BEFORE_MINUTES])
  })

  it('считает время за N часов верно', () => {
    const startsAt = new Date('2026-10-05T13:00:00Z')
    const [hours] = planReminders(startsAt, notify({ beforeMinutes: 0 }), NOW)

    expect(hours.scheduledAt.toISOString()).toBe('2026-10-04T13:00:00.000Z')
  })

  it('считает время за N минут верно', () => {
    const startsAt = new Date('2026-10-05T13:00:00Z')
    const [minutes] = planReminders(startsAt, notify({ beforeHours: 0 }), NOW)

    expect(minutes.scheduledAt.toISOString()).toBe('2026-10-05T12:00:00.000Z')
  })

  it('ничего не планирует при выключенных уведомлениях', () => {
    const startsAt = new Date('2026-10-05T13:00:00Z')
    expect(planReminders(startsAt, notify({ enabled: false }), NOW)).toEqual([])
  })

  it('пропускает напоминание с нулевым сдвигом', () => {
    const startsAt = new Date('2026-10-05T13:00:00Z')
    const result = planReminders(startsAt, notify({ beforeMinutes: 0 }), NOW)

    expect(kinds(result)).toEqual([ReminderKind.BEFORE_HOURS])
  })

  it('не планирует напоминание, момент которого уже прошёл', () => {
    // Занятие через 2 часа: напоминание «за 24 часа» пришлось бы на вчера.
    // Без этой проверки оно ушло бы немедленно как просроченное.
    const startsAt = new Date('2026-10-01T12:00:00Z')
    const result = planReminders(startsAt, notify(), NOW)

    expect(kinds(result)).toEqual([ReminderKind.BEFORE_MINUTES])
  })

  it('не планирует ничего для занятия в прошлом', () => {
    const startsAt = new Date('2026-09-30T13:00:00Z')
    expect(planReminders(startsAt, notify(), NOW)).toEqual([])
  })

  it('не планирует ничего для занятия, начавшегося только что', () => {
    const result = planReminders(NOW, notify(), NOW)
    expect(result).toEqual([])
  })

  it('работает с большим сдвигом в часах', () => {
    const startsAt = new Date('2026-10-20T13:00:00Z')
    const [hours] = planReminders(startsAt, notify({ beforeHours: 168, beforeMinutes: 0 }), NOW)

    expect(hours.scheduledAt.toISOString()).toBe('2026-10-13T13:00:00.000Z')
  })

  describe('тихие часы', () => {
    // Москва = UTC+3, тишина 22:00–09:00
    const quiet = { quietFrom: '22:00', quietTo: '09:00' }
    const early = new Date('2026-10-01T10:00:00Z')

    it('не трогает напоминание вне тишины', () => {
      // Занятие в 16:00 по Москве: «за час» уходит в 15:00
      const [minutes] = planReminders(new Date('2026-10-05T13:00:00Z'), notify({ beforeHours: 0, ...quiet }), early)
      expect(minutes.scheduledAt.toISOString()).toBe('2026-10-05T12:00:00.000Z')
    })

    it('«за сутки» про утреннее занятие переносит на конец тишины накануне', () => {
      // Занятие в 8:00 по Москве 5 октября → 9:00 по Москве 4 октября
      const [hours] = planReminders(new Date('2026-10-05T05:00:00Z'), notify({ beforeMinutes: 0, ...quiet }), early)
      expect(hours.scheduledAt.toISOString()).toBe('2026-10-04T06:00:00.000Z')
    })

    it('«за час» про утреннее занятие переносит на вечер накануне', () => {
      // 7:00 по Москве — тишина, до 9:00 ждать нельзя → 21:59 по Москве 4 октября
      const [minutes] = planReminders(new Date('2026-10-05T05:00:00Z'), notify({ beforeHours: 0, ...quiet }), early)
      expect(minutes.scheduledAt.toISOString()).toBe('2026-10-04T18:59:00.000Z')
    })

    it('считает тишину в таймзоне репетитора', () => {
      // 12:00 UTC — день в Москве, но 22:00 во Владивостоке
      const startsAt = new Date('2026-10-05T13:00:00Z')
      const [minutes] = planReminders(startsAt, notify({ beforeHours: 0, ...quiet }), early, 'Asia/Vladivostok')
      expect(minutes.scheduledAt.toISOString()).toBe('2026-10-05T11:59:00.000Z')
    })

    it('не шлёт два напоминания в одну минуту', () => {
      // «За 2 часа» и «за час» про занятие в 8:00 оба уезжают на 21:59
      const result = planReminders(new Date('2026-10-05T05:00:00Z'), notify({ beforeHours: 2, ...quiet }), early)
      expect(result).toHaveLength(1)
    })

    it('одинаковые границы означают «тишины нет»', () => {
      const [minutes] = planReminders(
        new Date('2026-10-05T05:00:00Z'),
        notify({ beforeHours: 0, quietFrom: '09:00', quietTo: '09:00' }),
        early,
      )
      expect(minutes.scheduledAt.toISOString()).toBe('2026-10-05T04:00:00.000Z')
    })
  })
})
