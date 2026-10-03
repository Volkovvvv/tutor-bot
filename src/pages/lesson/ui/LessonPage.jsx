import { lessonEnd, lessonPrice } from '../../../entities/lesson/index.js'
import { levelLabel } from '../../../entities/student/index.js'
import { EditLessonStatus } from '../../../features/edit-lesson-status/index.js'
import { LessonMaterial } from '../../../features/lesson-material/index.js'
import { dayTitle } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'
import {
  Actions,
  BackButton,
  Button,
  InfoList,
  InfoRow,
  PageTitle,
  Pill,
  Screen,
  Switch,
} from '../../../shared/ui/index.js'
import s from './LessonPage.module.css'

export default function LessonPage({
  lesson,
  student,
  backLabel,
  onBack,
  onOpenStudent,
  onSetStatus,
  onTogglePaid,
  onDelete,
  subjects = [],
  onAddSubject,
  country,
  onSetCountry,
}) {
  if (!lesson) return null

  const name = student?.name ?? 'Удалённый ученик'
  const level = levelLabel(student) ?? student?.note

  return (
    <Screen>
      <BackButton onClick={onBack}>{backLabel}</BackButton>

      <div className={s.head}>
        {level ? <Pill>{level}</Pill> : null}
        {student ? (
          <button type="button" className={s.nameLink} onClick={() => onOpenStudent(student.id)}>
            <PageTitle>{name} ›</PageTitle>
          </button>
        ) : (
          <PageTitle>{name}</PageTitle>
        )}
      </div>

      <InfoList>
        <InfoRow label="Дата">{dayTitle(lesson.date)}</InfoRow>
        <InfoRow label="Время">{lesson.time}–{lessonEnd(lesson)}</InfoRow>
        <InfoRow label="Стоимость">{formatMoney(lessonPrice(lesson, student))}</InfoRow>
        <InfoRow label="Оплачено">
          <Switch checked={lesson.paid} onChange={() => onTogglePaid(lesson.id)} label="Оплачено" />
        </InfoRow>
      </InfoList>

      <EditLessonStatus lesson={lesson} onSetStatus={onSetStatus} />

      <LessonMaterial
        lessonId={lesson.id}
        student={student}
        subjects={subjects}
        onAddSubject={onAddSubject}
        country={country}
        onSetCountry={onSetCountry}
        onOpenStudent={onOpenStudent}
      />

      <Actions>
        <Button variant="danger" onClick={() => onDelete(lesson.id)}>Удалить занятие</Button>
      </Actions>
    </Screen>
  )
}
