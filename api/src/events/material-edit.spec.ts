import type { MaterialContent } from '../materials/material-content'
import { editShare } from './material-edit'

function material(): MaterialContent {
  return {
    title: 'Тема',
    theory: [
      { h: 'Что это', p: 'Объяснение', rule: 'Правило', ex: null },
      { h: 'Как решать', p: 'Шаги', rule: null, ex: 'Пример' },
    ],
    mistakes: ['Ошибка 1'],
    example: { task: 'Задача', solution: 'Решение' },
    homework: [
      { task: 'Задание 1', tag: null, answer: '1' },
      { task: 'Задание 2', tag: null, answer: '2' },
    ],
  }
}

describe('editShare', () => {
  it('без правок — ноль', () => {
    expect(editShare(material(), material())).toBe(0)
  })

  it('считает долю изменённых полей', () => {
    const after = material()
    after.homework[0].task = 'Другое задание'
    // непустых полей: теория 3+3 → 6, ошибки 1, пример 2, домашка 4 → 13; изменено 1
    expect(editShare(material(), after)).toBe(0.08)
  })

  it('пробелы по краям — не правка', () => {
    const after = material()
    after.theory[0].p = '  Объяснение '
    expect(editShare(material(), after)).toBe(0)
  })

  it('удалённое задание считается изменением его полей', () => {
    const after = material()
    after.homework.pop()
    expect(editShare(material(), after)).toBeGreaterThan(0.1)
  })

  it('полностью другой материал — единица', () => {
    const after: MaterialContent = {
      title: 'Тема',
      theory: [{ h: 'A', p: 'B', rule: 'C', ex: 'D' }],
      mistakes: ['E'],
      example: { task: 'F', solution: 'G' },
      homework: [{ task: 'H', tag: null, answer: 'I' }],
    }
    expect(editShare(material(), after)).toBe(1)
  })
})
