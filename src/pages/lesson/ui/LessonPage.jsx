import { STATUS_LABELS } from '../../../entities/lesson/index.js'
import { EditLessonStatus } from '../../../features/edit-lesson-status/index.js'
import { formatDate } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'

export default function LessonPage({ lesson, student, onBack, onSetStatus, onTogglePaid, onDelete }) {
  if (!lesson) return null

  return (
    <>
      <button className="back" onClick={onBack}>← Назад</button>
      <h1>{student?.name ?? 'Удалённый ученик'}</h1>

      <div className="summary">
        <div className="summary-row"><span>Дата</span><b>{formatDate(lesson.date)} в {lesson.time}</b></div>
        <div className="summary-row"><span>Цена</span><b>{formatMoney(student?.price ?? 0)}</b></div>
        <div className="summary-row"><span>Статус</span><b>{STATUS_LABELS[lesson.status]}</b></div>
        <div className="summary-row"><span>Оплата</span><b>{lesson.paid ? 'Оплачено' : 'Не оплачено'}</b></div>
      </div>

      <EditLessonStatus
        lesson={lesson}
        onSetStatus={onSetStatus}
        onTogglePaid={onTogglePaid}
      />

      <div className="actions">
        <button className="btn btn-danger" onClick={() => onDelete(lesson.id)}>Удалить занятие</button>
      </div>
    </>
  )
}
