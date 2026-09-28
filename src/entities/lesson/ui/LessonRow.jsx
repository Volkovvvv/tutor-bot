import { Badge, ListRow } from '../../../shared/ui/index.js'
import { STATUS_LABELS } from '../model/lesson.js'

const STATUS_TONE = { done: 'positive', cancelled: 'struck' }

// title — что показывать первой строкой: имя ученика (общий список)
// или дату (история внутри карточки ученика)
export default function LessonRow({ lesson, title, subtitle, onClick }) {
  return (
    <ListRow
      onClick={onClick}
      title={title}
      subtitle={subtitle}
      trailing={
        <>
          <Badge tone={STATUS_TONE[lesson.status]}>{STATUS_LABELS[lesson.status]}</Badge>
          {lesson.status !== 'cancelled' ? (
            <Badge tone={lesson.paid ? 'positive' : 'negative'}>
              {lesson.paid ? 'Оплачено' : 'Не оплачено'}
            </Badge>
          ) : null}
        </>
      }
    />
  )
}
