// view: { name, id?, prev? }
// prev — экран, с которого пришли: «назад» возвращает ровно туда,
// в том числе по цепочке «Сегодня → урок → ученик → урок».

export const TABS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'calendar', label: 'Календарь' },
  { value: 'students', label: 'Ученики' },
  { value: 'money', label: 'Деньги' },
]

export const LIST_VIEWS = TABS.map((t) => t.value)

const LABELS = {
  ...Object.fromEntries(TABS.map((t) => [t.value, t.label])),
  student: 'Ученик',
  lesson: 'Урок',
}

export function openView(current, next) {
  return { ...next, prev: current }
}

export function backTarget(view) {
  return view.prev ?? { name: 'today' }
}

export function backLabel(view) {
  return LABELS[backTarget(view).name] ?? 'Назад'
}

// После удаления объекта, на который смотрит один из экранов цепочки,
// возвращаемся к первому экрану, который не про него
export function backPast(view, isGone) {
  let target = backTarget(view)
  while (target.prev && isGone(target)) target = target.prev
  return isGone(target) ? { name: 'today' } : target
}
