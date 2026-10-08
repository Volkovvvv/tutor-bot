import type { MaterialContent } from '../materials/material-content'

/** Все тексты материала в стабильном порядке: пары «поле → значение». */
function textsOf(c: MaterialContent): Map<string, string> {
  const out = new Map<string, string>()
  const put = (key: string, value: string | null | undefined) => out.set(key, (value ?? '').trim())

  c.theory.forEach((t, i) => {
    put(`theory.${i}.h`, t.h)
    put(`theory.${i}.p`, t.p)
    put(`theory.${i}.rule`, t.rule)
    put(`theory.${i}.ex`, t.ex)
  })
  c.mistakes.forEach((m, i) => put(`mistakes.${i}`, m))
  put('example.task', c.example.task)
  put('example.solution', c.example.solution)
  c.homework.forEach((h, i) => {
    put(`homework.${i}.task`, h.task)
    put(`homework.${i}.answer`, h.answer)
  })
  return out
}

/**
 * Какую долю текста репетитор изменил: от 0 до 1.
 *
 * Считаются поля, непустые хотя бы в одной из версий, — пустые rule/ex у блоков
 * теории иначе разбавили бы долю. Добавленное и удалённое задание считается
 * изменением всех его полей.
 */
export function editShare(before: MaterialContent, after: MaterialContent): number {
  const a = textsOf(before)
  const b = textsOf(after)
  const keys = new Set([...a.keys(), ...b.keys()])

  let total = 0
  let changed = 0
  for (const key of keys) {
    const x = a.get(key) ?? ''
    const y = b.get(key) ?? ''
    if (!x && !y) continue
    total += 1
    if (x !== y) changed += 1
  }
  return total === 0 ? 0 : Math.round((changed / total) * 100) / 100
}
