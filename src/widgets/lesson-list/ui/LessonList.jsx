import { LessonRow, sortLessons } from '../../../entities/lesson/index.js'
import { indexById } from '../../../entities/student/index.js'
import { formatDate } from '../../../shared/lib/date.js'

export default function LessonList({ lessons, students, onOpen }) {
  const sorted = sortLessons(lessons)
  // Индекс по id: имя ученика нужно для каждой строки списка
  const studentById = indexById(students)

  if (sorted.length === 0) {
    return (
      <div className="empty">
        <div className="empty-art">📅</div>
        <div className="empty-title">Расписание пока пустое</div>
        Добавьте занятие — ученик получит напоминание,
        а доход попадёт в итоги месяца.
      </div>
    )
  }

  return sorted.map((l) => (
    <LessonRow
      key={l.id}
      lesson={l}
      title={studentById.get(l.studentId)?.name ?? 'Удалённый ученик'}
      subtitle={`${formatDate(l.date)} в ${l.time}`}
      onClick={() => onOpen(l.id)}
    />
  ))
}
