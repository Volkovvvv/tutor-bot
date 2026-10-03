// Черновик правок материала. Отличается от ответа API двумя вещами:
// у элементов списков есть id (ключи React переживают удаление строк),
// а вместо null — пустые строки, чтобы поля были управляемыми.

let nextId = 1
const withId = (item) => ({ id: nextId++, ...item })

const EMPTY = {
  theory: { h: '', p: '', ex: '' },
  mistakes: { text: '' },
  homework: { task: '', tag: '', answer: '' },
}

export function toDraft(material) {
  return {
    title: material.title ?? material.topic,
    theory: material.theory.map((t) => withId({ h: t.h, p: t.p, ex: t.ex ?? '' })),
    mistakes: material.mistakes.map((text) => withId({ text })),
    example: { ...material.example },
    homework: material.homework.map((h) => withId({ task: h.task, tag: h.tag ?? '', answer: h.answer ?? '' })),
  }
}

// Пустые блоки сервер отбросит сам — здесь только снимаем id
export function fromDraft(draft) {
  return {
    title: draft.title,
    theory: draft.theory.map(({ h, p, ex }) => ({ h, p, ex })),
    mistakes: draft.mistakes.map((m) => m.text),
    example: draft.example,
    homework: draft.homework.map(({ task, tag, answer }) => ({ task, tag, answer })),
  }
}

// Сервер требует теорию, пример и хотя бы одно задание
export function isValidDraft(draft) {
  return (
    draft.theory.some((t) => t.h.trim() && t.p.trim()) &&
    draft.example.task.trim().length > 0 &&
    draft.example.solution.trim().length > 0 &&
    draft.homework.some((h) => h.task.trim())
  )
}

export function draftReducer(draft, action) {
  switch (action.type) {
    case 'title':
      return { ...draft, title: action.value }
    case 'example':
      return { ...draft, example: { ...draft.example, ...action.patch } }
    case 'item':
      return {
        ...draft,
        [action.list]: draft[action.list].map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item
        ),
      }
    case 'remove':
      return { ...draft, [action.list]: draft[action.list].filter((item) => item.id !== action.id) }
    case 'add':
      return { ...draft, [action.list]: [...draft[action.list], withId(EMPTY[action.list])] }
    default:
      return draft
  }
}
