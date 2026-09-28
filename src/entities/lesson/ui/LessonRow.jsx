import { Badge, ListRow } from '../../../shared/ui/index.js'
import { lessonBadge } from '../model/lesson.js'
import s from './LessonRow.module.css'

// Строка расписания: время слева, ученик и предмет, бейдж статуса справа
export default function LessonRow({ lesson, title, subtitle, isNext, onClick }) {
  const badge = lessonBadge(lesson, isNext)
  return (
    <ListRow
      onClick={onClick}
      dimmed={lesson.status === 'cancelled'}
      leading={<span className={s.time}>{lesson.time}</span>}
      title={title}
      subtitle={subtitle}
      trailing={<Badge tone={badge.tone}>{badge.label}</Badge>}
    />
  )
}
