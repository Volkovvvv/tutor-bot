import {
  applyDoubts,
  applyTheoryFindings,
  buildCompareMessages,
  buildSolveMessages,
  buildTheoryCheckMessages,
  carryDoubts,
  checkItems,
  isCheckedSubject,
  parseDoubts,
  parseSolved,
  parseTheoryFindings,
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
    expect(isCheckedSubject('Английский язык')).toBe(true)
    expect(isCheckedSubject('Химия')).toBe(false)
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

describe('проверка теории', () => {
  const material: MaterialContent = {
    ...content,
    theory: [
      { h: 'Сила разгоняет', p: 'Чем больше сила, тем сильнее разгон.', rule: 'F = m · a', ex: null },
      { h: 'Краткая форма', p: 'В краткой форме столько же Н, сколько в полной.', rule: 'Пиши столько Н, сколько в полной.', ex: 'ценный — ценен' },
    ],
    mistakes: ['Думают, что краткая форма всегда с одной Н.'],
  }

  it('даёт проверяющему тему, класс и весь конспект, но не ключ домашки', () => {
    const [system, user] = buildTheoryCheckMessages('Русский язык', 7, 'Н и НН в прилагательных', material)
    expect(system.content).toContain('сверь примеры с правилами')
    expect(system.content).toContain('из углублённого курса')
    expect(system.content).toContain('Сомневаешься, что это ошибка, — не отмечай')
    expect(user.content).toContain('Ученик: 7 класс.')
    expect(user.content).toContain('«Н и НН в прилагательных»')
    expect(user.content).toContain('ценный — ценен')
    expect(user.content).toContain('Думают, что краткая форма всегда с одной Н.')
    expect(user.content).not.toContain('4 м/с²')
  })

  it('разбирает находки, пустой список и мусор', () => {
    const raw = '```json\n{"findings":[{"block":" Краткая форма ","note":" Для мужского рода одна Н: ценен. "},{"block":"x","note":""},{"note":"Без блока"}]}\n```'
    expect(parseTheoryFindings(raw)).toEqual([
      { block: 'Краткая форма', note: 'Для мужского рода одна Н: ценен.' },
      { block: '', note: 'Без блока' },
    ])
    expect(parseTheoryFindings('{"findings":[]}')).toEqual([])
    expect(parseTheoryFindings('Всё хорошо')).toBeNull()
    expect(parseTheoryFindings('{"findings":"нет"}')).toBeNull()
  })

  it('берёт не больше трёх находок', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ block: `Блок ${i}`, note: `Замечание ${i}` }))
    expect(parseTheoryFindings(JSON.stringify({ findings: many }))).toHaveLength(3)
  })

  it('кладёт находку в блок по заголовку, остальное — общей пометкой', () => {
    const result = applyTheoryFindings(material, [
      { block: 'краткая форма.', note: 'Для мужского рода одна Н.' },
      { block: 'Типичные ошибки', note: 'Пример не показывает ошибку.' },
      { block: '', note: 'Общее замечание.' },
    ])
    expect(result.theory.map((t) => t.doubt)).toEqual([null, 'Для мужского рода одна Н.'])
    expect(result.theoryDoubt).toBe('Типичные ошибки: Пример не показывает ошибку. Общее замечание.')
  })

  it('не путает короткие заголовки и заменяет прежние пометки новой проверкой', () => {
    const short = { ...material, theory: [{ h: 'Н', p: 'x', rule: null, ex: null, doubt: 'старая пометка' }] }
    const result = applyTheoryFindings(short, [{ block: 'Нн в причастиях', note: 'Спорная норма.' }])
    expect(result.theory[0].doubt).toBeNull()
    expect(result.theoryDoubt).toBe('Нн в причастиях: Спорная норма.')
    expect(applyTheoryFindings(short, []).theoryDoubt).toBeNull()
  })

  it('оставляет замечание к блоку, пока блок не тронут', () => {
    const flagged = applyTheoryFindings(material, [
      { block: 'Краткая форма', note: 'Для мужского рода одна Н.' },
      { block: 'Типичные ошибки', note: 'Пример не показывает ошибку.' },
    ])
    const fromForm = (c: MaterialContent): MaterialContent => ({
      ...c,
      theory: c.theory.map(({ h, p, rule, ex }) => ({ h, p, rule, ex })),
      theoryDoubt: null,
    })

    const untouched = carryDoubts(flagged, fromForm(flagged))
    expect(untouched.theory[1].doubt).toBe('Для мужского рода одна Н.')
    expect(untouched.theoryDoubt).toBe('Типичные ошибки: Пример не показывает ошибку.')

    const edited = fromForm(flagged)
    edited.theory[1] = { ...edited.theory[1], rule: 'В мужском роде одна Н, в остальных — как в полной форме.' }
    edited.mistakes = ['Пишут ценнен вместо ценен.']
    const result = carryDoubts(flagged, edited)
    expect(result.theory[1].doubt).toBeNull()
    expect(result.theoryDoubt).toBeNull()
  })
})

describe('проверка ответов по английскому', () => {
  it('говорит решающему и сверяющему про краткие формы и неоднозначные задания', () => {
    const [solver] = buildSolveMessages('Английский', 9, items)
    const [comparer] = buildCompareMessages(items, ['5 м/с²', null, '10 Н'])
    expect(solver.content).toContain('Натянутые варианты не предлагай')
    expect(buildSolveMessages('Русский язык', 9, items, 'Приставки ПРЕ- и ПРИ-')[1].content).toContain('Тема урока: «Приставки ПРЕ- и ПРИ-».')
    expect(comparer.content).toContain('haven\'t')
    expect(comparer.content).toContain('неоднозначно')
  })
})
