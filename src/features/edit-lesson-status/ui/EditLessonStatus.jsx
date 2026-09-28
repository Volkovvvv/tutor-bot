import { STATUS_LABELS } from '../../../entities/lesson/index.js'
import { Button, Section } from '../../../shared/ui/index.js'

const STATUSES = ['planned', 'done', 'cancelled']

// Текущий вариант — лаймовой кнопкой, остальные — белыми
export default function EditLessonStatus({ lesson, onSetStatus, onTogglePaid }) {
  return (
    <>
      <Section title="Статус">
        {STATUSES.map((status) => (
          <Button
            key={status}
            variant={lesson.status === status ? 'primary' : 'secondary'}
            aria-pressed={lesson.status === status}
            onClick={() => onSetStatus(lesson.id, status)}
          >
            {STATUS_LABELS[status]}
          </Button>
        ))}
      </Section>

      <Section title="Оплата">
        <Button
          variant={lesson.paid ? 'primary' : 'secondary'}
          aria-pressed={lesson.paid}
          onClick={() => onTogglePaid(lesson.id)}
        >
          {lesson.paid ? 'Оплачено ✓' : 'Отметить оплаченным'}
        </Button>
      </Section>
    </>
  )
}
