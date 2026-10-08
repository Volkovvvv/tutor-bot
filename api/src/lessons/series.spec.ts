import { sameWeeklySlot, seriesOccurrences, weeksLater } from './series'

const MSK = 'Europe/Moscow'
const BERLIN = 'Europe/Berlin'

describe('weeksLater', () => {
  it('прибавляет недели там, где часы не переводят', () => {
    const first = new Date('2026-10-08T13:00:00Z') // чт 16:00 МСК
    expect(weeksLater(first, 3, MSK).toISOString()).toBe('2026-10-29T13:00:00.000Z')
  })

  it('держит время на часах при переводе часов', () => {
    // чт 16:00 в Берлине: до 25 октября это UTC+2, после — UTC+1
    const first = new Date('2026-10-22T14:00:00Z')
    expect(weeksLater(first, 1, BERLIN).toISOString()).toBe('2026-10-29T15:00:00.000Z')
  })

  it('с незнакомой зоной считает как UTC', () => {
    const first = new Date('2026-10-22T14:00:00Z')
    expect(weeksLater(first, 1, 'Mars/Olympus').toISOString()).toBe('2026-10-29T14:00:00.000Z')
  })
})

describe('seriesOccurrences', () => {
  const first = new Date('2026-10-08T13:00:00Z')

  it('отдаёт занятия от первого до горизонта включительно', () => {
    const got = seriesOccurrences(first, null, new Date('2026-10-22T13:00:00Z'), MSK)
    expect(got.map((d) => d.toISOString())).toEqual([
      '2026-10-08T13:00:00.000Z',
      '2026-10-15T13:00:00.000Z',
      '2026-10-22T13:00:00.000Z',
    ])
  })

  it('продолжает строго после отметки', () => {
    const got = seriesOccurrences(first, new Date('2026-10-15T13:00:00Z'), new Date('2026-10-30T00:00:00Z'), MSK)
    expect(got.map((d) => d.toISOString())).toEqual(['2026-10-22T13:00:00.000Z', '2026-10-29T13:00:00.000Z'])
  })

  it('у давней серии находит ближайшие занятия', () => {
    const got = seriesOccurrences(first, new Date('2028-03-01T00:00:00Z'), new Date('2028-03-10T00:00:00Z'), MSK)
    expect(got.map((d) => d.toISOString())).toEqual(['2028-03-02T13:00:00.000Z', '2028-03-09T13:00:00.000Z'])
  })

  it('останавливается на конце серии', () => {
    const got = seriesOccurrences(first, null, new Date('2026-12-01T00:00:00Z'), MSK, new Date('2026-10-22T13:00:00Z'))
    expect(got).toHaveLength(2)
  })

  it('пусто, если первое занятие за горизонтом', () => {
    expect(seriesOccurrences(first, null, new Date('2026-10-01T00:00:00Z'), MSK)).toEqual([])
  })
})

describe('sameWeeklySlot', () => {
  it('узнаёт тот же день и время через несколько недель', () => {
    expect(sameWeeklySlot(new Date('2026-10-08T13:00:00Z'), new Date('2026-11-05T13:00:00Z'), MSK)).toBe(true)
    expect(sameWeeklySlot(new Date('2026-11-05T13:00:00Z'), new Date('2026-10-08T13:00:00Z'), MSK)).toBe(true)
  })

  it('различает другое время и другой день', () => {
    expect(sameWeeklySlot(new Date('2026-10-08T13:00:00Z'), new Date('2026-10-15T14:00:00Z'), MSK)).toBe(false)
    expect(sameWeeklySlot(new Date('2026-10-08T13:00:00Z'), new Date('2026-10-09T13:00:00Z'), MSK)).toBe(false)
  })

  it('не сбивается переводом часов', () => {
    expect(sameWeeklySlot(new Date('2026-10-22T14:00:00Z'), new Date('2026-10-29T15:00:00Z'), BERLIN)).toBe(true)
  })
})
