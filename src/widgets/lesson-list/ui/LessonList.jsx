import { LessonRow, sortLessons } from '../../../entities/lesson/index.js'
import { indexById } from '../../../entities/student/index.js'
import { formatDate } from '../../../shared/lib/date.js'
import { EmptyState, Stack } from '../../../shared/ui/index.js'

export default function LessonList({ lessons, students, onOpen }) {
  const sorted = sortLessons(lessons)
  // Индекс по id: имя ученика нужно для каждой строки списка
  const studentById = indexById(students)

  if (sorted.length === 0) {
    return (
      <EmptyState icon="📅" title="Расписание пока пустое">
        Добавьте занятие — ученик получит напоминание,
        а доход попадёт в итоги месяца.
      </EmptyState>
    )
  }

  return (
    <Stack>
      {sorted.map((l) => (
        <LessonRow
          key={l.id}
          lesson={l}
          title={studentById.get(l.studentId)?.name ?? 'Удалённый ученик'}
          subtitle={`${formatDate(l.date)} в ${l.time}`}
          onClick={() => onOpen(l.id)}
        />
      ))}
    </Stack>
  )
}
