import { STATUS_LABELS } from '../model/lesson.js'

// title — что показывать первой строкой: имя ученика (общий список)
// или дату (история внутри карточки ученика)
export default function LessonRow({ lesson, title, subtitle, onClick }) {
  return (
    <button className="card" onClick={onClick}>
      <div>
        <div className="card-title">{title}</div>
        <div className="card-sub">{subtitle}</div>
      </div>
      <div className="card-right">
        <div
          className={`badge ${
            lesson.status === 'done' ? 'done' : lesson.status === 'cancelled' ? 'cancelled' : ''
          }`}
        >
          {STATUS_LABELS[lesson.status]}
        </div>
        {lesson.status !== 'cancelled' ? (
          <div className={`card-sub badge ${lesson.paid ? 'paid' : 'unpaid'}`} style={{ marginTop: 4 }}>
            {lesson.paid ? 'Оплачено' : 'Не оплачено'}
          </div>
        ) : null}
      </div>
    </button>
  )
}
