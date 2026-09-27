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
})
