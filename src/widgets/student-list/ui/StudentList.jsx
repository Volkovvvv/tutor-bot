import { StudentCard } from '../../../entities/student/index.js'
import { EmptyState, Stack } from '../../../shared/ui/index.js'

export default function StudentList({ students, lessons, onOpen }) {
  // Индекс: иначе для каждого ученика пришлось бы фильтровать весь массив занятий
  const countById = new Map()
  for (const l of lessons) {
    countById.set(l.studentId, (countById.get(l.studentId) ?? 0) + 1)
  }

  if (students.length === 0) {
    return (
      <EmptyState icon="🎓" title="Здесь появятся ваши ученики">
        Пригласите первого — и напоминания о занятиях
        начнут приходить ему автоматически.
      </EmptyState>
    )
  }

  return (
    <Stack>
      {students.map((s) => (
        <StudentCard
          key={s.id}
          student={s}
          lessonCount={countById.get(s.id) ?? 0}
          onClick={() => onOpen(s.id)}
        />
      ))}
    </Stack>
  )
}
