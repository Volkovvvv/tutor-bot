import { buildMessages, coerceContent, levelLabel, parseContent, templateContent } from './material-content'
import { renderMaterialPdf } from './material-pdf'

const valid = {
  title: 'Второй закон Ньютона',
  theory: [{ h: 'Формулировка', p: 'Чем сильнее толкаешь, тем быстрее разгон.', rule: 'F = m·a', ex: 'm = 2 кг, a = 3 м/с² → F = 6 Н' }],
  mistakes: ['Путают массу и вес: вес — это сила.'],
  example: { task: 'm = 2 кг, F = 10 Н. Найди a.', solution: '1) a = F / m.\n2) a = 5 м/с².' },
  homework: [
    { task: 'Задача 1', tag: null, answer: '5 Н' },
    { task: 'Задача 2', tag: 'ЕГЭ · задание 2', answer: '2 м/с²' },
  ],
}

const input = {
  subject: 'Физика',
  topic: 'Закон Ома',
  grade: 8,
  goal: 'SCHOOL' as const,
  country: 'RU' as const,
  homeworkCount: 6,
}

describe('parseContent', () => {
  it('разбирает чистый JSON', () => {
    expect(parseContent(JSON.stringify(valid))).toEqual(valid)
  })

  it('достаёт JSON из markdown и рассуждений модели', () => {
    const raw = `<think>{"theory": "не то"}</think>Вот материалы:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``
    expect(parseContent(raw)).toEqual(valid)
  })

  it('выбрасывает пустые и нестроковые пункты', () => {
    const raw = JSON.stringify({
      ...valid,
      theory: [{ h: ' ', p: 'x' }, { h: 'Ок', p: 'Текст' }, 'мусор'],
      mistakes: ['', 7],
      homework: [{ task: '' }, 42, { task: 'Задача', tag: 5 }],
    })
    expect(parseContent(raw)).toEqual({
      ...valid,
      theory: [{ h: 'Ок', p: 'Текст', rule: null, ex: null }],
      mistakes: [],
      homework: [{ task: 'Задача', tag: null, answer: null }],
    })
  })

  it('разносит шаги решения по строкам', () => {
    const raw = JSON.stringify({ ...valid, example: { task: 'x', solution: '1) Раз. 2) Два (см. п. 1). 3) Три.' } })
    expect(parseContent(raw)?.example.solution).toBe('1) Раз.\n2) Два (см. п. 1).\n3) Три.')
  })

  it('возвращает null без обязательных частей', () => {
    expect(parseContent('Не могу помочь')).toBeNull()
    expect(parseContent('{broken')).toBeNull()
    expect(parseContent(JSON.stringify({ ...valid, homework: [] }))).toBeNull()
    expect(parseContent(JSON.stringify({ ...valid, example: { task: 'x' } }))).toBeNull()
  })
})

describe('coerceContent', () => {
  it('читает материалы старого формата: домашка строками, без ошибок и ответов', () => {
    const old = {
      theory: [{ h: 'Формулировка', p: 'F = m·a.' }],
      example: valid.example,
      homework: ['Задача 1'],
    }
    expect(coerceContent(old)).toEqual({
      title: null,
      theory: [{ h: 'Формулировка', p: 'F = m·a.', rule: null, ex: null }],
      mistakes: [],
      example: valid.example,
      homework: [{ task: 'Задача 1', tag: null, answer: null }],
    })
  })
})

describe('buildMessages', () => {
  it('подставляет предмет, тему, класс и число заданий', () => {
    const [system, user] = buildMessages(input)
    expect(user.content).toContain('Предмет: Физика.')
    expect(user.content).toContain('Ученик: 8 класс.')
    expect(user.content).toContain('«Закон Ома»')
    expect(user.content).toContain('экзамена нет')
    expect(system.content).toContain('ровно 6 заданий')
  })

  it('без экзамена программа — по стране репетитора', () => {
    const [system, user] = buildMessages({ ...input, country: 'BY' })
    expect(user.content).toContain('белорусская школа')
    expect(system.content).toContain('tag у всех заданий — null')
  })

  it('экзамен задаёт формат последних заданий и страну', () => {
    const [system, user] = buildMessages({ ...input, goal: 'CE', country: 'RU', homeworkCount: 10 })
    expect(user.content).toContain('белорусская школа')
    expect(user.content).toContain('подготовка к экзамену — ЦЭ')
    expect(system.content).toContain('Последние 3 задания')
    expect(system.content).toContain('ЦЭ · часть B')
  })
})

describe('levelLabel', () => {
  it('собирает подпись из класса и цели', () => {
    expect(levelLabel(10, 'EGE')).toBe('10 класс · ЕГЭ')
    expect(levelLabel(8, 'SCHOOL')).toBe('8 класс')
    expect(levelLabel(null, 'CT')).toBe('ЦТ')
    expect(levelLabel(null, 'SCHOOL')).toBeNull()
  })
})

describe('renderMaterialPdf', () => {
  it('собирает PDF с кириллицей', async () => {
    const pdf = await renderMaterialPdf({
      subject: 'Физика',
      topic: 'Второй закон Ньютона',
      studentName: 'Аня',
      level: '9 класс',
      date: '29 сентября 2026',
      tutorLine: 'Анна Сергеевна · репетитор по физике',
      content: templateContent('Второй закон Ньютона'),
    })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(10_000)
  })

  it('версия с ответами длиннее на страницу', async () => {
    const base = {
      subject: 'Физика',
      topic: 'Второй закон Ньютона',
      studentName: 'Аня',
      level: '9 класс · ОГЭ',
      date: '29 сентября 2026',
      tutorLine: 'Анна Сергеевна',
      content: valid,
    }
    const pages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length
    const student = await renderMaterialPdf(base)
    const tutor = await renderMaterialPdf({ ...base, withAnswers: true })
    expect(pages(tutor)).toBe(pages(student) + 1)
  })
})
