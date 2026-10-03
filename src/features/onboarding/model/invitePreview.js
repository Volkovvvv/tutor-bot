// Превью приглашения для последнего шага онбординга.
// Настоящий текст собирает сервер (api/src/invites/invite-message.ts) —
// меняя формулировку там, поправьте и здесь.

export { SUBJECTS } from '../../../shared/lib/subjects.js'

const DATIVE = {
  Математика: 'математике',
  Физика: 'физике',
  'Русский язык': 'русскому языку',
  Английский: 'английскому языку',
  Химия: 'химии',
  Информатика: 'информатике',
}

function subjectsPhrase(subjects) {
  const known = subjects.map((s) => DATIVE[s]).filter(Boolean).slice(0, 2)
  return known.length ? ` по ${known.join(' и ')}` : ''
}

export function invitePreview({ studentName, tutorName, subjects }) {
  const who = tutorName ? `${tutorName} приглашает вас` : 'Вас приглашают'
  return (
    `${studentName || 'Аня'}, привет! ${who} на занятия${subjectsPhrase(subjects)}. ` +
    'Напоминания об уроках будут приходить через этого бота. ' +
    'Нажмите ссылку и кнопку «Начать» — этого достаточно.'
  )
}
