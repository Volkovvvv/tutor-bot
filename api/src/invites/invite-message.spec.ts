import { inviteMessage, subjectsPhrase } from './invite-message'

describe('subjectsPhrase', () => {
  it('склоняет известные предметы', () => {
    expect(subjectsPhrase(['Математика'])).toBe(' по математике')
    expect(subjectsPhrase(['Математика', 'Физика'])).toBe(' по математике и физике')
  })

  it('пропускает неизвестные и берёт не больше двух', () => {
    expect(subjectsPhrase(['Шахматы'])).toBe('')
    expect(subjectsPhrase(['Химия', 'Шахматы', 'Физика', 'Математика'])).toBe(' по химии и физике')
  })
})

describe('inviteMessage', () => {
  const link = 'https://t.me/bot?start=abc'

  it('подписывает приглашение именем репетитора', () => {
    const text = inviteMessage({ studentName: 'Аня', tutorName: 'Анна Сергеевна', subjects: ['Математика'], link })
    expect(text).toContain('Аня, привет! Анна Сергеевна приглашает вас на занятия по математике.')
    expect(text).toContain(link)
  })

  it('обходится без имени и предметов', () => {
    const text = inviteMessage({ studentName: 'Аня', tutorName: null, subjects: [], link })
    expect(text).toContain('Аня, привет! Вас приглашают на занятия.')
  })
})
