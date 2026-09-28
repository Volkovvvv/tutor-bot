import { STATUS_LABELS } from '../../../entities/lesson/index.js'
import { EditLessonStatus } from '../../../features/edit-lesson-status/index.js'
import { formatDate } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'
import {
  Actions,
  BackButton,
  Button,
  InfoList,
  InfoRow,
  PageTitle,
  Screen,
} from '../../../shared/ui/index.js'

export default function LessonPage({ lesson, student, onBack, onSetStatus, onTogglePaid, onDelete }) {
  if (!lesson) return null

  return (
    <Screen>
      <BackButton onClick={onBack} />
      <PageTitle>{student?.name ?? 'Удалённый ученик'}</PageTitle>

      <InfoList>
        <InfoRow label="Дата">{formatDate(lesson.date)} в {lesson.time}</InfoRow>
        <InfoRow label="Цена">{formatMoney(student?.price ?? 0)}</InfoRow>
        <InfoRow label="Статус">{STATUS_LABELS[lesson.status]}</InfoRow>
        <InfoRow label="Оплата">{lesson.paid ? 'Оплачено' : 'Не оплачено'}</InfoRow>
      </InfoList>

      <EditLessonStatus
        lesson={lesson}
        onSetStatus={onSetStatus}
        onTogglePaid={onTogglePaid}
      />

      <Actions>
        <Button variant="danger" onClick={() => onDelete(lesson.id)}>Удалить занятие</Button>
      </Actions>
    </Screen>
  )
}
