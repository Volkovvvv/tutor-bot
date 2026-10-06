import {
  applyDoubts,
  buildCompareMessages,
  buildSolveMessages,
  carryDoubts,
  checkItems,
  isCheckedSubject,
  parseDoubts,
  parseSolved,
} from './answer-check'
import type { MaterialContent } from './material-content'

const content: MaterialContent = {
  title: 'Второй закон Ньютона',
  theory: [{ h: 'Сила разгоняет', p: 'Чем больше сила, тем сильнее разгон.', rule: 'F = m · a', ex: null }],
  mistakes: [],
  example: { task: 'm = 2 кг, F = 10 Н. Найди a.', solution: '1) a = F / m.\n2) a = 5 м/с².' },
  homework: [
    { task: 'm = 3 кг, F = 12 Н. Найди a.', tag: null, answer: '4 м/с²' },
    { task: 'Объясни своими словами, что такое сила.', tag: null, answer: null },
    { task: 'm = 5 кг, a = 2 м/с². Найди F.', tag: null, answer: '12 Н' },
  ],
  check: 'pending',
}
const items = checkItems(content)

describe('isCheckedSubject', () => {
  it('проверяет предметы с однозначным ответом в любом написании', () => {
    expect(isCheckedSubject('Физика')).toBe(true)
    expect(isCheckedSubject(' геометрия ')).toBe(true)
    expect(isCheckedSubject('русский')).toBe(true)
    expect(isCheckedSubject('Английский')).toBe(false)
    expect(isCheckedSubject('Рисование')).toBe(false)
  })
})

describe('checkItems', () => {
  it('берёт разобранный пример и задания с ответом', () => {
    expect(items).toEqual([
      { task: 'm = 2 кг, F = 10 Н. Найди a.', key: '1) a = F / m.\n2) a = 5 м/с².' },
      { task: 'm = 3 кг, F = 12 Н. Найди a.', key: '4 м/с²' },
      { task: 'm = 5 кг, a = 2 м/с². Найди F.', key: '12 Н' },
    ])
  })
})

describe('buildSolveMessages', () => {
  it('даёт условия без ключа', () => {
    const [, user] = buildSolveMessages('Физика', 9, items)
    expect(user.content).toContain('Предмет: Физика.')
    expect(user.content).toContain('Ученик: 9 класс.')
    expect(user.content).toContain('3. m = 5 кг, a = 2 м/с². Найди F.')
    expect(user.content).not.toContain('a = F / m')
    expect(user.content).not.toContain('4 м/с²')
  })
})

describe('parseSolved', () => {
  it('раскладывает ответы по номерам заданий', () => {
    const raw = '```json\n{"solved":[{"n":3,"answer":"10 Н"},{"n":1,"answer":" 5 м/с² "},{"n":9,"answer":"лишнее"}]}\n```'
    expect(parseSolved(raw, 3)).toEqual(['5 м/с²', null, '10 Н'])
  })

  it('возвращает null, если ответов нет', () => {
    expect(parseSolved('не знаю', 3)).toBeNull()
    expect(parseSolved('{"solved":[]}', 3)).toBeNull()
  })
})

describe('buildCompareMessages', () => {
  it('сводит ключ и ответ проверяющего, пропуская нерешённые', () => {
    const [, user] = buildCompareMessages(items, ['5 м/с²', null, '10 Н'])
    const rows = user.content.split('\n').map((line) => JSON.parse(line))
    expect(rows).toEqual([
      { n: 1, task: items[0].task, key: items[0].key, own: '5 м/с²' },
      { n: 3, task: items[2].task, key: '12 Н', own: '10 Н' },
    ])
  })
})

describe('parseDoubts', () => {
  it('раскладывает пометки по номерам заданий', () => {
    expect(parseDoubts('{"doubts":[{"n":3,"note":"У проверки 10 Н, в ключе 12 Н."}]}', 3)).toEqual([
      null,
      null,
      'У проверки 10 Н, в ключе 12 Н.',
    ])
  })

  it('отличает «расхождений нет» от неразобранного ответа', () => {
    expect(parseDoubts('{"doubts":[]}', 2)).toEqual([null, null])
    expect(parseDoubts('всё хорошо', 2)).toBeNull()
  })
})

describe('applyDoubts', () => {
  const notes = [null, null, 'У проверки 10 Н, в ключе 12 Н.']

  it('помечает задание и закрывает проверку', () => {
    const result = applyDoubts(content, items, notes)
    expect(result.check).toBe('done')
    expect(result.example.doubt).toBeNull()
    expect(result.homework.map((h) => h.doubt)).toEqual([null, null, 'У проверки 10 Н, в ключе 12 Н.'])
  })

  it('не помечает задание, которое репетитор успел исправить', () => {
    const edited = {
      ...content,
      homework: [content.homework[2], content.homework[0]].map((h, i) => (i === 0 ? { ...h, answer: '10 Н' } : h)),
    }
    expect(applyDoubts(edited, items, notes).homework.map((h) => h.doubt)).toEqual([null, null])
  })

  it('находит задание после перестановки', () => {
    const moved = { ...content, homework: [content.homework[2], content.homework[0]] }
    expect(applyDoubts(moved, items, notes).homework.map((h) => h.doubt)).toEqual([
      'У проверки 10 Н, в ключе 12 Н.',
      null,
    ])
  })
})

describe('carryDoubts', () => {
  const checked = applyDoubts(content, items, [null, null, 'У проверки 10 Н, в ключе 12 Н.'])
  // Форма правки присылает материал без пометок
  const fromForm = (c: MaterialContent): MaterialContent => ({
    ...c,
    check: null,
    example: { task: c.example.task, solution: c.example.solution },
    homework: c.homework.map(({ task, tag, answer }) => ({ task, tag, answer })),
  })

  it('оставляет пометку, пока задание не тронуто', () => {
    const next = carryDoubts(checked, { ...fromForm(checked), title: 'Новый заголовок' })
    expect(next.check).toBe('done')
    expect(next.homework[2].doubt).toBe('У проверки 10 Н, в ключе 12 Н.')
  })

  it('снимает пометку, когда ответ исправлен', () => {
    const form = fromForm(checked)
    form.homework[2] = { ...form.homework[2], answer: '10 Н' }
    expect(carryDoubts(checked, form).homework[2].doubt).toBeNull()
  })
})
