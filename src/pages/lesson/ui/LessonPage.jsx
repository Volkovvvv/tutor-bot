import { useState } from 'react'
import { lessonEnd, lessonPrice } from '../../../entities/lesson/index.js'
import { levelLabel } from '../../../entities/student/index.js'
import { EditLessonStatus } from '../../../features/edit-lesson-status/index.js'
import { LessonMaterial } from '../../../features/lesson-material/index.js'
import { dayMonth, dayTitle } from '../../../shared/lib/date.js'
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
  Sheet,
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
  tutorName,
}) {
  // Удаление необратимо и уносит материалы урока — сначала спрашиваем
  const [confirming, setConfirming] = useState(false)
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
        tutorName={tutorName}
        date={`${dayMonth(lesson.date)} ${lesson.date.slice(0, 4)}`}
        onDelete={() => setConfirming(true)}
      />

      <Actions>
        <Button variant="danger" onClick={() => setConfirming(true)}>Удалить занятие</Button>
      </Actions>

      {confirming ? (
        <Sheet
          title="Удалить занятие?"
          subtitle={`${name}, ${dayTitle(lesson.date).toLowerCase()}, ${lesson.time}. Занятие исчезнет из расписания вместе с материалами урока. Вернуть его не получится.`}
          onClose={() => setConfirming(false)}
        >
          <Button variant="danger" className={s.confirm} onClick={() => onDelete(lesson.id)}>Удалить</Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>Не удалять</Button>
        </Sheet>
      ) : null}
    </Screen>
  )
}
