/**
 * Текст приглашения ученику. Отдельно от сервиса, чтобы проверять
 * тестами без базы.
 *
 * Превью этого же текста показывает онбординг мини-аппа
 * (src/features/onboarding/model/invitePreview.js) — меняя формулировку,
 * поправьте и его.
 */

// «Занятия по …» требует дательного падежа. Склоняем только известные
// предметы: неправильный падеж хуже, чем отсутствие предмета в тексте.
const DATIVE: Record<string, string> = {
  Математика: 'математике',
  Физика: 'физике',
  'Русский язык': 'русскому языку',
  Английский: 'английскому языку',
  Химия: 'химии',
  Информатика: 'информатике',
}

/** «по математике и физике» или пустая строка. */
export function subjectsPhrase(subjects: string[]): string {
  const known = subjects.map((s) => DATIVE[s]).filter(Boolean).slice(0, 2)
  return known.length ? ` по ${known.join(' и ')}` : ''
}

export function inviteMessage(opts: {
  studentName: string
  tutorName: string | null
  subjects: string[]
  link: string
}): string {
  const who = opts.tutorName ? `${opts.tutorName} приглашает вас` : 'Вас приглашают'
  return (
    `${opts.studentName}, привет! ${who} на занятия${subjectsPhrase(opts.subjects)}. ` +
    `Напоминания об уроках будут приходить через этого бота.\n\n` +
    `Нажмите ссылку и кнопку «Начать» — этого достаточно:\n${opts.link}`
  )
}
