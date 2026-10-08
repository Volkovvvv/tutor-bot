import { lessonReminderText } from './messages'

describe('lessonReminderText', () => {
  const startsAt = new Date('2026-10-05T13:00:00Z')
  const sameDay = new Date('2026-10-05T12:00:00Z')

  it('показывает время в таймзоне репетитора', () => {
    // 13:00 UTC = 16:00 в Москве: репетитор ставил занятие
    // в своём времени и должен увидеть именно его.
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', sameDay)).toContain('16:00')
  })

  it('учитывает другую таймзону', () => {
    expect(lessonReminderText('Аня', startsAt, 'Asia/Vladivostok', sameDay)).toContain('23:00')
  })

  it('в день занятия пишет «сегодня»', () => {
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', sameDay)).toContain('сегодня в 16:00')
  })

  it('накануне пишет «завтра», даже если до занятия меньше суток', () => {
    // 22:00 по Москве 4 октября — тихие часы сдвинули напоминание «за час» на вечер
    const text = lessonReminderText('Аня', startsAt, 'Europe/Moscow', new Date('2026-10-04T19:00:00Z'))
    expect(text).toContain('завтра в 16:00')
  })

  it('за несколько дней указывает дату', () => {
    const text = lessonReminderText('Аня', startsAt, 'Europe/Moscow', new Date('2026-10-02T12:00:00Z'))
    expect(text).toContain('5 октября')
    expect(text).not.toContain('сегодня')
  })

  it('включает имя ученика', () => {
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', sameDay)).toMatch(/^Аня/)
  })

  it('подписывает пояс: привычным названием или смещением', () => {
    expect(lessonReminderText('Аня', startsAt, 'Europe/Moscow', sameDay)).toContain('в 16:00 мск.')
    expect(lessonReminderText('Аня', startsAt, 'Asia/Yekaterinburg', sameDay)).toContain('в 18:00 UTC+5.')
    expect(lessonReminderText('Аня', startsAt, 'Asia/Kolkata', sameDay)).toContain('в 18:30 UTC+5:30.')
    expect(lessonReminderText('Аня', startsAt, 'UTC', sameDay)).toContain('в 13:00 UTC.')
  })

  it('день считает в поясе репетитора, а не сервера', () => {
    // 22:30 UTC 4 октября — во Владивостоке уже 5-е: занятие 5-го там «сегодня»
    const text = lessonReminderText('Аня', startsAt, 'Asia/Vladivostok', new Date('2026-10-04T22:30:00Z'))
    expect(text).toContain('сегодня в 23:00')
  })
})
