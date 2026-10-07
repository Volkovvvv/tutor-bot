import {
  buildMessages,
  coerceContent,
  levelLabel,
  materialsLimit,
  parseContent,
  reasoningEffort,
  templateContent,
  withoutCheck,
} from './material-content'
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
    expect(parseContent(JSON.stringify(valid))).toEqual(withoutCheck(valid))
  })

  it('достаёт JSON из markdown и рассуждений модели', () => {
    const raw = `<think>{"theory": "не то"}</think>Вот материалы:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``
    expect(parseContent(raw)).toEqual(withoutCheck(valid))
  })

  it('выбрасывает пустые и нестроковые пункты', () => {
    const raw = JSON.stringify({
      ...valid,
      theory: [{ h: ' ', p: 'x' }, { h: 'Ок', p: 'Текст' }, 'мусор'],
      mistakes: ['', 7],
      homework: [{ task: '' }, 42, { task: 'Задача', tag: 5 }],
    })
    expect(parseContent(raw)).toEqual(
      withoutCheck({
        ...valid,
        theory: [{ h: 'Ок', p: 'Текст', rule: null, ex: null }],
        mistakes: [],
        homework: [{ task: 'Задача', tag: null, answer: null }],
      }),
    )
  })

  it('ставит пропуски на месте букв в двойных скобках', () => {
    const raw = JSON.stringify({
      ...valid,
      example: { task: 'Вставь буквы: Он хочет учи[[ть]]ся.', solution: '1) Хочет что делать? — учи[[ть]]ся.' },
      homework: [
        { task: 'Вставь буквы: Мне пора собира[[ть]]ся, а брат умывае[[т]]ся.', answer: 'собира[[ть]]ся, умывается' },
        { task: 'Вставь буквы: Дверь не открывае[[т]]ся.', answer: null },
        { task: 'Реши неравенство и запиши ответ промежутком вида [1; 5].', answer: '[2; 7]' },
      ],
    })
    const parsed = parseContent(raw)
    expect(parsed?.example).toMatchObject({
      task: 'Вставь буквы: Он хочет учи..ся.',
      solution: '1) Хочет что делать? — учиться.',
    })
    expect(parsed?.homework.map(({ task, answer }) => ({ task, answer }))).toEqual([
      { task: 'Вставь буквы: Мне пора собира..ся, а брат умывае..ся.', answer: 'собираться, умывается' },
      { task: 'Вставь буквы: Дверь не открывае..ся.', answer: 'Вставь буквы: Дверь не открывается.' },
      { task: 'Реши неравенство и запиши ответ промежутком вида [1; 5].', answer: '[2; 7]' },
    ])
  })

  it('итог проверки ответов из ответа модели не берёт', () => {
    const raw = JSON.stringify({
      ...valid,
      check: 'done',
      homework: [{ task: 'Задача', answer: '5', doubt: 'выдумка модели' }],
    })
    expect(parseContent(raw)).toMatchObject({ check: null, homework: [{ task: 'Задача', doubt: null }] })
  })

  it('разносит шаги решения по строкам', () => {
    const raw = JSON.stringify({ ...valid, example: { task: 'x', solution: '1) Раз. 2) Два (см. п. 1). 3) Три.' } })
    expect(parseContent(raw)?.example.solution).toBe('1) Раз.\n2) Два (см. п. 1).\n3) Три.')
  })

  it('не рвёт формулу со скобкой после числа', () => {
    const solution = '1) (x − 1)(x + 1) = 3.\n2) x² = 4.'
    const raw = JSON.stringify({ ...valid, example: { task: 'x', solution: '1) (x − 1)(x + 1) = 3. 2) x² = 4.' } })
    expect(parseContent(raw)?.example.solution).toBe(solution)
  })

  it('заменяет словами знаки, которых нет в шрифте PDF', () => {
    const raw = JSON.stringify({
      ...valid,
      theory: [{ h: 'Углы', p: '∠A = ∠D = 50°. ∠B лежит напротив AC.', rule: 'AB ⊥ CD, MN∥KL', ex: 'Точка M ∈ AB' }],
    })
    expect(parseContent(raw)?.theory[0]).toEqual({
      h: 'Углы',
      p: 'Угол A = угол D = 50°. Угол B лежит напротив AC.',
      rule: 'AB перпендикулярно CD, MN параллельно KL',
      ex: 'Точка M принадлежит AB',
    })
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
    expect(coerceContent(old)).toEqual(
      withoutCheck({
        title: null,
        theory: [{ h: 'Формулировка', p: 'F = m·a.', rule: null, ex: null }],
        mistakes: [],
        example: valid.example,
        homework: [{ task: 'Задача 1', tag: null, answer: null }],
      }),
    )
  })

  it('сохраняет итог проверки ответов из базы', () => {
    const stored = {
      ...valid,
      check: 'done',
      example: { ...valid.example, doubt: 'У проверки 4 м/с², в ключе 5 м/с².' },
      homework: [{ task: 'Задача 1', answer: '5 Н', doubt: 'У проверки 6 Н, в ключе 5 Н.' }],
    }
    expect(coerceContent(stored)).toMatchObject({
      check: 'done',
      example: { doubt: 'У проверки 4 м/с², в ключе 5 м/с².' },
      homework: [{ doubt: 'У проверки 6 Н, в ключе 5 Н.' }],
    })
    expect(coerceContent({ ...valid, check: 'что-то' })?.check).toBeNull()
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

  it('добавляет пожелания репетитора одной строкой после темы', () => {
    const user = buildMessages({ ...input, wishes: '  больше текстовых задач,\nбез «дробей»  ' })[1].content
    expect(user).toContain('Пожелания репетитора к этому материалу: «больше текстовых задач, без "дробей"».')
    expect(user.indexOf('Пожелания репетитора')).toBeGreaterThan(user.indexOf('Тема урока'))
    expect(buildMessages(input)[1].content).not.toContain('Пожелания репетитора')
    expect(buildMessages({ ...input, wishes: '   ' })[1].content).not.toContain('Пожелания репетитора')
    expect(buildMessages({ ...input, wishes: 'я'.repeat(900) })[1].content).toContain(`«${'я'.repeat(500)}»`)
  })

  it('в младших классах просит записывать правила словами', () => {
    expect(buildMessages({ ...input, grade: 5 })[0].content).toContain('правила действий записывай словами')
    expect(buildMessages({ ...input, grade: 6 })[0].content).toContain('правила действий записывай словами')
    expect(buildMessages({ ...input, grade: 7 })[0].content).not.toContain('правила действий записывай словами')
    expect(buildMessages({ ...input, grade: null })[0].content).not.toContain('правила действий записывай словами')
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

  it('с карточкой формата даёт образцы заданий экзамена', () => {
    const [system, user] = buildMessages({ ...input, subject: 'Математика', grade: 9, goal: 'OGE' })
    expect(system.content).toContain('из списка «Формат экзамена»')
    expect(system.content).toContain('В их tag напиши «ОГЭ»')
    expect(user.content).toContain('Формат экзамена — типы заданий из демоверсии')
    expect(user.content).toContain('Найди значение выражения')
  })

  it('карточки ОГЭ и ЕГЭ есть для всех предметов с демоверсией', () => {
    for (const goal of ['OGE', 'EGE'] as const) {
      for (const subject of ['Русский язык', 'Математика', 'Физика', 'Химия', 'Биология', 'Английский']) {
        const [, user] = buildMessages({ ...input, subject, goal })
        expect(user.content).toContain('Формат экзамена — типы заданий из демоверсии')
      }
    }
  })

  it('с карточкой программы даёт порядок тем класса', () => {
    const by = { ...input, subject: 'Математика', country: 'BY' as const }
    for (const grade of [5, 6, 7, 8, 9, 10, 11]) {
      expect(buildMessages({ ...by, grade })[1].content).toContain(`Учебная программа ученика — математика, ${grade} класс`)
    }
    const grade8 = buildMessages({ ...by, grade: 8 })[1].content
    expect(grade8).toContain('2. Квадратные уравнения')
    expect(grade8).toContain('Геометрия:')
    expect(grade8).toContain('В 7 классе пройдено')
    expect(buildMessages({ ...by, grade: 10 })[1].content).toContain('На повышенном уровне')
    // ЦЭ сдают в Беларуси — программа белорусская, где бы ни жил репетитор
    expect(buildMessages({ ...by, grade: 11, goal: 'CE', country: 'RU' })[1].content).toContain('Учебная программа ученика')
    expect(buildMessages({ ...by, subject: ' алгебра ', grade: 8 })[1].content).toContain('Учебная программа ученика — математика, 8 класс')
    expect(buildMessages({ ...by, grade: 8, country: 'RU' })[1].content).not.toContain('Учебная программа ученика')
    expect(buildMessages({ ...by, grade: null })[1].content).not.toContain('Учебная программа ученика')
    expect(buildMessages({ ...by, subject: 'Физика', grade: 8 })[1].content).not.toContain('Учебная программа ученика')
  })

  it('при подготовке к экзамену программа не запрещает темы следующих классов', () => {
    const by10 = { ...input, subject: 'Математика', grade: 10, country: 'BY' as const }
    const school = buildMessages(by10)[1].content
    expect(school).toContain('он ещё не проходил')
    expect(school).toContain('Показательной и логарифмической функций в 10 классе нет')
    const exam = buildMessages({ ...by10, goal: 'CE' })[1].content
    expect(exam).toContain('тема урока может быть из любого класса')
    expect(exam).not.toContain('он ещё не проходил')
    expect(exam).not.toContain('в 10 классе нет')
  })

  it('учебник добавляет к программе только формулировки', () => {
    const by6 = { ...input, subject: 'Математика', grade: 6, country: 'BY' as const }
    const user = buildMessages(by6)[1].content
    expect(user).toContain('Учебник ученика — Математика, 6 класс')
    expect(user).toContain('«Рациональные числа»: Модуль числа')
    expect(user).not.toContain('Глава 4.')
    expect(user.match(/Найди тему урока/g)).toHaveLength(1)
    expect(buildMessages({ ...by6, grade: 7 })[1].content).not.toContain('Учебник ученика')
    expect(buildMessages({ ...by6, country: 'RU' })[1].content).not.toContain('Учебник ученика')
  })

  it('карточку находит по любому известному написанию предмета', () => {
    expect(buildMessages({ ...input, subject: 'Английский язык', goal: 'OGE' })[1].content).toContain('Формат экзамена')
    expect(buildMessages({ ...input, subject: 'геометрия', goal: 'OGE' })[1].content).toContain('Найди значение выражения')
    expect(buildMessages({ ...input, subject: 'Алгебра', goal: 'EGE' })[1].content).toContain('профильный уровень')
  })

  it('без карточки формата образцов нет', () => {
    const [system, user] = buildMessages({ ...input, subject: 'Информатика', goal: 'OGE' })
    expect(system.content).toContain('Формулировка и варианты ответа — как на экзамене')
    expect(user.content).not.toContain('Формат экзамена')
  })
})

describe('materialsLimit', () => {
  it('читает лимит из настройки, пустое и ноль — без лимита', () => {
    expect(materialsLimit('5')).toBe(5)
    expect(materialsLimit(15)).toBe(15)
    for (const off of [undefined, '', '0', 0, '-3', '2.5', 'много']) expect(materialsLimit(off)).toBeNull()
  })
})

describe('reasoningEffort', () => {
  it('читает уровень из настройки, пустое и опечатка — high', () => {
    expect(reasoningEffort('low')).toBe('low')
    expect(reasoningEffort(' Medium ')).toBe('medium')
    expect(reasoningEffort('none')).toBe('none')
    for (const unknown of [undefined, '', 'hihg', 'выкл', 3]) expect(reasoningEffort(unknown)).toBe('high')
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
