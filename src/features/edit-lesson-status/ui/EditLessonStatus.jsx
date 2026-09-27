import { STATUS_LABELS } from '../../../entities/lesson/index.js'

const STATUSES = ['planned', 'done', 'cancelled']

export default function EditLessonStatus({ lesson, onSetStatus, onTogglePaid }) {
  return (
    <>
      <div className="section-title">Статус</div>
      <div className="actions">
        {STATUSES.map((status) => (
          <button
            key={status}
            className={`btn ${lesson.status === status ? '' : 'btn-secondary'}`}
            onClick={() => onSetStatus(lesson.id, status)}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="section-title">Оплата</div>
      <div className="actions">
        <button
          className={`btn ${lesson.paid ? '' : 'btn-secondary'}`}
          onClick={() => onTogglePaid(lesson.id)}
        >
          {lesson.paid ? 'Оплачено ✓' : 'Отметить оплаченным'}
        </button>
      </div>
    </>
  )
}
