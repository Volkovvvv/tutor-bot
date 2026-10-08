import { buildStats, formatStats, median, type StatEvent } from './stats'

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 12))
const ev = (tutorId: string, name: string, props: Record<string, unknown> = {}, day = 8): StatEvent => ({
  tutorId,
  name,
  props,
  createdAt: at(day),
})
const base = { tutors: 5, seen24h: 2, seen7d: 4 }

describe('median', () => {
  it('нечётное и чётное число значений', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(3)
    expect(median([])).toBeNull()
  })
})

describe('buildStats', () => {
  it('считает собравших, возвращавшихся и медиану сборки', () => {
    const s = buildStats({
      ...base,
      events: [
        ev('a', 'material_generated', { ms: 40000 }, 8),
        ev('a', 'material_generated', { ms: 60000 }, 9),
        ev('b', 'material_generated', { ms: 50000 }, 8),
        ev('b', 'material_generated', { ms: 50000 }, 8),
      ],
    })
    expect(s.generators).toBe(2)
    expect(s.generated).toBe(4)
    // a — в два разных дня, b — оба раза в один
    expect(s.returners).toBe(1)
    expect(s.medianMs).toBe(50000)
  })

  it('оценки и причины низких', () => {
    const s = buildStats({
      ...base,
      events: [
        ev('a', 'material_rating', { good: true }),
        ev('a', 'material_rating', { good: false, reason: 'content' }),
        ev('b', 'material_rating', { good: false, reason: 'content' }),
        ev('b', 'material_rating', { good: false, reason: 'long' }),
      ],
    })
    expect(s.rated).toEqual({ up: 1, down: 3, reasons: { content: 2, long: 1 } })
  })

  it('правки: по материалу берётся наибольшая доля', () => {
    const s = buildStats({
      ...base,
      events: [
        ev('a', 'material_edited', { lessonId: 'l1', share: 0.1 }),
        ev('a', 'material_edited', { lessonId: 'l1', share: 0.5 }),
        ev('a', 'material_edited', { lessonId: 'l2', share: 0.05 }),
      ],
    })
    expect(s.edited).toEqual({ materials: 2, strong: 1 })
  })

  it('использование: материал, скачанный и отправленный, считается один раз', () => {
    const s = buildStats({
      ...base,
      events: [
        ev('a', 'pdf_downloaded', { lessonId: 'l1', answers: true }),
        ev('a', 'pdf_sent', { lessonId: 'l1', answers: false }),
        ev('a', 'pdf_sent', { lessonId: 'l2', answers: false }),
      ],
    })
    expect(s.downloaded).toBe(1)
    expect(s.sent).toBe(2)
    expect(s.usedMaterials).toBe(2)
  })

  it('лимит и заявки считаются по людям, а не по событиям', () => {
    const s = buildStats({
      ...base,
      events: [ev('a', 'limit_hit'), ev('a', 'limit_hit'), ev('b', 'limit_hit'), ev('a', 'upgrade_interest')],
    })
    expect(s.limitHit).toBe(2)
    expect(s.upgradeInterest).toBe(1)
  })

  it('ответы бота', () => {
    const s = buildStats({
      ...base,
      events: [
        ev('a', 'material_forwarded', { yes: true }),
        ev('b', 'material_forwarded', { yes: false }),
        ev('a', 'retention_answer', { answer: 'very' }),
        ev('b', 'retention_answer', { answer: 'no' }),
      ],
    })
    expect(s.forwarded).toEqual({ yes: 1, no: 1 })
    expect(s.retention).toEqual({ very: 1, little: 0, no: 1 })
  })

  it('пустой журнал не ломает сводку', () => {
    const s = buildStats({ ...base, events: [] })
    expect(s.generated).toBe(0)
    expect(s.medianMs).toBeNull()
    const text = formatStats(s)
    expect(text).toContain('Собрали хотя бы один: 0 из 5')
    expect(text).toContain('пока не спрашивали')
  })
})

describe('formatStats', () => {
  it('показывает долю положительных оценок и причины', () => {
    const text = formatStats(
      buildStats({
        ...base,
        events: [
          ev('a', 'material_rating', { good: true }),
          ev('a', 'material_rating', { good: false, reason: 'level' }),
        ],
      }),
    )
    expect(text).toContain('👍 1 · 👎 1 (50% положительных)')
    expect(text).toContain('не та сложность 1')
  })
})
