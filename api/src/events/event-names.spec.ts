import { cleanClientProps, cleanProps, isEventName } from './event-names'

describe('isEventName', () => {
  it('знает серверные и клиентские события', () => {
    expect(isEventName('material_generated')).toBe(true)
    expect(isEventName('material_rating')).toBe(true)
  })

  it('отвергает чужие имена', () => {
    expect(isEventName('drop_table')).toBe(false)
    expect(isEventName(42)).toBe(false)
  })
})

describe('cleanProps', () => {
  it('оставляет числа, булевы и короткие строки', () => {
    expect(cleanProps({ ms: 1200, answers: true, model: 'openai/gpt' })).toEqual({
      ms: 1200,
      answers: true,
      model: 'openai/gpt',
    })
  })

  it('отбрасывает длинные строки целиком, а не обрезает', () => {
    expect(cleanProps({ topic: 'Теорема Виета и её применение к решению квадратных уравнений' })).toEqual({})
  })

  it('отбрасывает вложенное, null и неправильные ключи', () => {
    expect(cleanProps({ a: { b: 1 }, c: null, d: [1], 'Bad Key': 1, e: NaN, ok: 1 })).toEqual({ ok: 1 })
  })

  it('не принимает не-объекты', () => {
    expect(cleanProps(null)).toEqual({})
    expect(cleanProps('x')).toEqual({})
    expect(cleanProps([1, 2])).toEqual({})
  })

  it('ограничивает число полей', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${String.fromCharCode(97 + (i % 26))}${'x'.repeat(i)}`, i]))
    expect(Object.keys(cleanProps(many)).length).toBeLessThanOrEqual(10)
  })
})

describe('cleanClientProps', () => {
  const lessonId = '3f2b8c1e-5a4d-4e7a-9b1c-2d3e4f5a6b7c'

  it('оценка: good, известная причина и id занятия', () => {
    expect(cleanClientProps('material_rating', { good: false, reason: 'content', lessonId })).toEqual({
      lessonId,
      good: false,
      reason: 'content',
    })
  })

  it('оценка: произвольный текст вместо причины не проходит', () => {
    expect(cleanClientProps('material_rating', { good: false, reason: 'Маша Иванова ошибается' })).toEqual({
      good: false,
    })
  })

  it('id занятия — только настоящий uuid', () => {
    expect(cleanClientProps('upgrade_interest', { lessonId: 'Маша' })).toEqual({})
  })

  it('лишние поля отбрасываются', () => {
    expect(cleanClientProps('upgrade_interest', { topic: 'секрет', name: 'Маша' })).toEqual({})
  })
})
