import { Avatar, ListRow } from '../../../shared/ui/index.js'
import { cx } from '../../../shared/lib/cx.js'
import { canNotify } from '../model/student.js'
import { formatMoney, pluralLessons } from '../../../shared/lib/format.js'
import s from './StudentCard.module.css'

export default function StudentCard({ student, lessonCount, onClick }) {
  return (
    <ListRow
      onClick={onClick}
      leading={<Avatar name={student.name} />}
      title={student.name}
      subtitle={pluralLessons(lessonCount)}
      meta={
        <>
          {student.source === 'telegram' ? (
            <div className={s.tag}>
              {student.username ? `@${student.username}` : 'из Telegram'}
            </div>
          ) : null}
          {canNotify(student) ? (
            <div className={cx(s.tag, s.notifyOn)}>🔔 напоминания включены</div>
          ) : null}
        </>
      }
      trailing={formatMoney(student.price)}
    />
  )
}
