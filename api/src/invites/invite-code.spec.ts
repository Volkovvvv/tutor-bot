import { generateInviteCode, isValidInviteCodeFormat } from './invite-code'

describe('generateInviteCode', () => {
  it('выдаёт код разрешённой Telegram длины и алфавита', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(16)
    // start-параметр Telegram: только A-Z a-z 0-9 _ -
    expect(code).toMatch(/^[a-z0-9]+$/)
  })

  it('не содержит похожих глифов', () => {
    // Коды иногда переписывают руками: 0/O и 1/l/I гарантируют ошибку.
    const joined = Array.from({ length: 200 }, generateInviteCode).join('')
    expect(joined).not.toMatch(/[01ilo]/)
  })

  it('не повторяется', () => {
    const codes = new Set(Array.from({ length: 5000 }, generateInviteCode))
    expect(codes.size).toBe(5000)
  })

  it('распределён равномерно по алфавиту', () => {
    // Проверка на modulo bias: при `byte % 31` первые символы
    // выпадали бы заметно чаще остальных.
    const counts = new Map<string, number>()
    for (let i = 0; i < 20_000; i += 1) {
      for (const ch of generateInviteCode()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1)
      }
    }
    const values = [...counts.values()]
    const expected = (20_000 * 16) / 31
    // Отклонение каждого символа не больше 15% от ожидаемого.
    for (const v of values) {
      expect(Math.abs(v - expected) / expected).toBeLessThan(0.15)
    }
  })
})

describe('isValidInviteCodeFormat', () => {
  it('принимает настоящий код', () => {
    expect(isValidInviteCodeFormat(generateInviteCode())).toBe(true)
  })

  it.each([
    ['пустую строку', ''],
    ['короткий код', 'abc'],
    ['длинный код', 'a'.repeat(64)],
    ['запрещённые глифы', '0000000000000000'],
    ['верхний регистр', 'ABCDEFGHJKMNPQRS'],
    ['SQL-инъекцию', "' OR 1=1--"],
    ['пробелы', 'abcd efgh jkmn p'],
  ])('отклоняет %s', (_name, value) => {
    expect(isValidInviteCodeFormat(value)).toBe(false)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['число', 12345],
    ['объект', {}],
  ])('отклоняет %s', (_name, value) => {
    expect(isValidInviteCodeFormat(value)).toBe(false)
  })
})
