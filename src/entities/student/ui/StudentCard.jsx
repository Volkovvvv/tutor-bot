import { Avatar, Badge, ListRow } from '../../../shared/ui/index.js'
import { formatMoney, pluralLessons } from '../../../shared/lib/format.js'
import { BOT_BADGES, INVITE_STATUS } from '../model/student.js'
import s from './StudentCard.module.css'

export default function StudentCard({ student, lessonCount, onClick }) {
  const [botLabel, botTone] = BOT_BADGES[student.inviteStatus ?? INVITE_STATUS.none]
  return (
    <ListRow
      onClick={onClick}
      leading={<Avatar name={student.name} />}
      title={student.name}
      subtitle={student.note || pluralLessons(lessonCount)}
      trailing={
        <>
          <span className={s.price}>{formatMoney(student.price)}</span>
          <Badge tone={botTone} size="small">{botLabel}</Badge>
        </>
      }
    />
  )
}
