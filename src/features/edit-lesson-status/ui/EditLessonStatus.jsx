import { LESSON_STATUSES, STATUS_LABELS } from '../../../entities/lesson/index.js'
import { Segmented } from '../../../shared/ui/index.js'

const OPTIONS = LESSON_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))

// Статус занятия одной строкой: «В плане · Проведено · Отменено»
export default function EditLessonStatus({ lesson, onSetStatus }) {
  return (
    <Segmented
      label="Статус занятия"
      options={OPTIONS}
      value={lesson.status}
      onChange={(status) => onSetStatus(lesson.id, status)}
    />
  )
}
