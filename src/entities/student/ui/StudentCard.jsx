import Avatar from '../../../shared/ui/Avatar.jsx'
import { canNotify } from '../model/student.js'
import { formatMoney, pluralLessons } from '../../../shared/lib/format.js'

export default function StudentCard({ student, lessonCount, onClick }) {
  return (
    <button className="card" onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Avatar name={student.name} />
        <div style={{ minWidth: 0 }}>
          <div className="card-title">{student.name}</div>
          <div className="card-sub">{pluralLessons(lessonCount)}</div>
          {student.source === 'telegram' ? (
            <div className="tg-badge">
              {student.username ? `@${student.username}` : 'из Telegram'}
            </div>
          ) : null}
          {canNotify(student) ? (
            <div className="tg-badge notify-on">🔔 напоминания включены</div>
          ) : null}
        </div>
      </div>
      <div className="card-right">{formatMoney(student.price)}</div>
    </button>
  )
}
