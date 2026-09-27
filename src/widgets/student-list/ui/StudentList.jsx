import { StudentCard } from '../../../entities/student/index.js'

export default function StudentList({ students, lessons, onOpen }) {
  // Индекс: иначе для каждого ученика пришлось бы фильтровать весь массив занятий
  const countById = new Map()
  for (const l of lessons) {
    countById.set(l.studentId, (countById.get(l.studentId) ?? 0) + 1)
  }

  if (students.length === 0) {
    return <div className="empty">Пока никого нет.<br />Добавьте первого ученика.</div>
  }

  return students.map((s) => (
    <StudentCard
      key={s.id}
      student={s}
      lessonCount={countById.get(s.id) ?? 0}
      onClick={() => onOpen(s.id)}
    />
  ))
}
