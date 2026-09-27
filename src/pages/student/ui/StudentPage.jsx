import { LessonRow, studentLessons, upcomingLessons } from '../../../entities/lesson/index.js'
import { ContactStudent } from '../../../features/contact-student/index.js'
import { InviteStudent } from '../../../features/invite-student/index.js'
import { NotifySettings } from '../../../features/notify-settings/index.js'
import { formatDate } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'

export default function StudentPage({
  student,
  lessons,
  onBack,
  onOpenLesson,
  onAddLesson,
  onDelete,
  onNotify,
  onInvite,
  onMarkAccepted,
  onUpdateNotify,
}) {
  if (!student) return null

  const { lessons: own, doneCount, owed } = studentLessons(lessons, student)
  const upcoming = upcomingLessons(lessons, student.id)

  return (
    <>
      <button className="back" onClick={onBack}>← Ученики</button>
      <h1>{student.name}</h1>

      <div className="summary">
        <div className="summary-row"><span>Цена за занятие</span><b>{formatMoney(student.price)}</b></div>
        <div className="summary-row"><span>Проведено всего</span><b>{doneCount}</b></div>
        <div className="summary-row"><span>Должен</span><b>{formatMoney(owed)}</b></div>
        {student.username ? (
          <div className="summary-row"><span>Telegram</span><b>@{student.username}</b></div>
        ) : null}
      </div>

      <InviteStudent
        student={student}
        onInvite={onInvite}
        onMarkAccepted={onMarkAccepted}
        onNotify={onNotify}
      />

      <NotifySettings student={student} onChange={onUpdateNotify} />

      <ContactStudent
        student={student}
        upcoming={upcoming}
        owed={owed}
        onNotify={onNotify}
      />

      <div className="section-title">История занятий</div>

      {own.length === 0 ? (
        <div className="empty">Занятий пока нет.</div>
      ) : (
        own.map((l) => (
          <LessonRow
            key={l.id}
            lesson={l}
            title={formatDate(l.date)}
            subtitle={`в ${l.time}`}
            onClick={() => onOpenLesson(l.id)}
          />
        ))
      )}

      <div className="actions">
        <button className="btn" onClick={() => onAddLesson(student.id)}>+ Добавить занятие</button>
        <button className="btn btn-danger" onClick={() => onDelete(student.id)}>Удалить ученика</button>
      </div>
    </>
  )
}
