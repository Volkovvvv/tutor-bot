// Предметы, которые предлагаются из коробки: в онбординге и в форме
// материалов урока. Любой другой репетитор вводит сам.
export const SUBJECTS = ['Физика', 'Английский', 'Математика']

// Знак в шапке листа материалов — тот же, что в PDF (api/src/materials/subjects.ts)
const SIGNS = [
  ['физика', 'Ω'],
  ['английский', 'Aa'],
  ['русский', 'Яя'],
]

export function subjectSign(subject) {
  const name = (subject ?? '').trim().toLowerCase()
  return SIGNS.find(([start]) => name.startsWith(start))?.[1] ?? '÷'
}
