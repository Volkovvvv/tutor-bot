import { debtReminderText, formatMoney, lessonReminderText } from './messages'

describe('formatMoney', () => {
  it('переводит копейки в рубли без лишних нулей', () => {
    expect(formatMoney(150_000)).toMatch(/1\s?500\s?₽/)
  })

  it('показывает копейки, когда они есть', () => {
    expect(formatMoney(150_050)).toMatch(/1\s?500,50\s?₽/)
  })

  it('обрабатывает ноль', () => {
    expect(formatMoney(0)).toMatch(/0\s?₽/)
  })
})

describe('lessonReminderText', () => {
  const startsAt = new Date('2026-10-05T13:00:00Z')

  it('показывает время в таймзоне репетитора', () => {
    // 13:00 UTC = 16:00 в Москве: репетитор ставил занятие
    // в своём времени и должен увидеть именно его.
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', true)).toContain('16:00')
  })

  it('учитывает другую таймзону', () => {
    expect(lessonReminderText('Аня', startsAt, 'Asia/Vladivostok', true)).toContain('23:00')
  })

  it('для близкого занятия пишет «сегодня»', () => {
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', true)).toContain('сегодня')
  })

  it('для далёкого занятия указывает дату', () => {
    const text = lessonReminderText('Аня', startsAt, 'Europe/Moscow', false)
    expect(text).toContain('октября')
    expect(text).not.toContain('сегодня')
  })

  it('включает имя ученика', () => {
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', true)).toMatch(/^Аня/)
  })
})

describe('debtReminderText', () => {
  it.each([
    [1, 'занятие'],
    [2, 'занятия'],
    [4, 'занятия'],
    [5, 'занятий'],
    [11, 'занятий'],
    [14, 'занятий'],
    [21, 'занятие'],
    [22, 'занятия'],
    [25, 'занятий'],
    [101, 'занятие'],
  ])('склоняет %i правильно: %s', (count, expected) => {
    expect(debtReminderText('Аня', count, 100_000)).toContain(`${count} ${expected}`)
  })

  it('включает сумму долга', () => {
    expect(debtReminderText('Аня', 2, 300_000)).toMatch(/3\s?000\s?₽/)
  })
})
