import { buildImportMessages, IMPORT_IMAGE_PATTERN, IMPORT_ROWS_MAX, parseImportRows } from './schedule-import'

describe('parseImportRows', () => {
  it('разбирает строки расписания', () => {
    const raw = '{"rows":[{"name":"Маша К.","weekday":1,"time":"16:00","duration":90,"unsure":false}]}'
    expect(parseImportRows(raw)).toEqual([
      { name: 'Маша К.', weekday: 1, time: '16:00', duration: 90, unsure: false },
    ])
  })

  it('достаёт JSON из текста с пояснениями', () => {
    const raw = 'Вот расписание:\n```json\n{"rows":[{"name":"Петя","weekday":3,"time":"18:30"}]}\n```'
    expect(parseImportRows(raw)).toEqual([
      { name: 'Петя', weekday: 3, time: '18:30', duration: null, unsure: false },
    ])
  })

  it('приводит время к HH:MM', () => {
    const raw = '{"rows":[{"name":"А","weekday":1,"time":"9:00"},{"name":"Б","weekday":"2","time":"17.30"}]}'
    expect(parseImportRows(raw)?.map((r) => [r.weekday, r.time])).toEqual([
      [1, '09:00'],
      [2, '17:30'],
    ])
  })

  it('оставляет строку без дня или времени и помечает её сомнительной', () => {
    const raw = '{"rows":[{"name":"Оля","weekday":9,"time":"25:00","duration":5000,"unsure":false}]}'
    expect(parseImportRows(raw)).toEqual([
      { name: 'Оля', weekday: null, time: null, duration: null, unsure: true },
    ])
  })

  it('пропускает строки без имени и мусор', () => {
    const raw = '{"rows":[{"name":"  ","weekday":1,"time":"10:00"},null,"обед",{"weekday":2,"time":"11:00"}]}'
    expect(parseImportRows(raw)).toEqual([])
  })

  it('обрезает слишком длинное расписание', () => {
    const rows = Array.from({ length: IMPORT_ROWS_MAX + 20 }, (_, i) => ({ name: `Ученик ${i}`, weekday: 1, time: '10:00' }))
    expect(parseImportRows(JSON.stringify({ rows }))).toHaveLength(IMPORT_ROWS_MAX)
  })

  it('возвращает null, когда ответ не JSON или в нём нет rows', () => {
    expect(parseImportRows('Не вижу расписания')).toBeNull()
    expect(parseImportRows('{"lessons":[]}')).toBeNull()
  })

  it('пустое расписание — не ошибка', () => {
    expect(parseImportRows('{"rows":[]}')).toEqual([])
  })
})

describe('buildImportMessages', () => {
  it('кладёт фото отдельной частью сообщения', () => {
    const image = 'data:image/jpeg;base64,AAAA'
    const [, user] = buildImportMessages({ image })
    expect(user.content).toEqual([
      { type: 'text', text: 'Расписание на фото.' },
      { type: 'image_url', image_url: { url: image } },
    ])
  })

  it('передаёт текст расписания', () => {
    const [, user] = buildImportMessages({ text: 'Пн 16:00 Маша' })
    expect(user.content).toEqual([{ type: 'text', text: 'Расписание:\nПн 16:00 Маша' }])
  })
})

describe('IMPORT_IMAGE_PATTERN', () => {
  it('пропускает только картинку в base64', () => {
    expect(IMPORT_IMAGE_PATTERN.test('data:image/jpeg;base64,/9j/4AAQ==')).toBe(true)
    expect(IMPORT_IMAGE_PATTERN.test('https://example.com/a.jpg')).toBe(false)
    expect(IMPORT_IMAGE_PATTERN.test('data:text/html;base64,AAAA')).toBe(false)
  })
})
