import { studentLessons, upcomingLessons } from '../../../entities/lesson/index.js'
import { levelLabel } from '../../../entities/student/index.js'
import { ContactStudent } from '../../../features/contact-student/index.js'
import { useState } from 'react'
import { EditStudentSheet } from '../../../features/edit-student/index.js'
import { EditStudentLevel } from '../../../features/edit-student-level/index.js'
import { InviteStudent } from '../../../features/invite-student/index.js'
import { NotifySettings } from '../../../features/notify-settings/index.js'
import { dayTitle } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'
import {
  Actions,
  Avatar,
  BackButton,
  Button,
  EmptyState,
  Group,
  GroupRow,
  InfoList,
  InfoRow,
  Note,
  PageTitle,
  Screen,
  Section,
  Sheet,
} from '../../../shared/ui/index.js'
import s from './StudentPage.module.css'

export default function StudentPage({
  student,
  lessons,
  backLabel,
  onBack,
  onOpenLesson,
  onAddLesson,
  onDelete,
  onArchive,
  onRestore,
  onNotify,
  onInvite,
  inviteLink,
  onUpdateNotify,
  onUpdateStudent,
}) {
  const [editing, setEditing] = useState(false)
  // Архивация убирает будущие занятия — сначала спрашиваем
  const [archiving, setArchiving] = useState(false)
  if (!student) return null

  const { lessons: own, doneCount, owed } = studentLessons(lessons, student)
  const upcoming = upcomingLessons(lessons, student.id)
  // Прошедшие и отменённые — свежие сверху
  const history = own.filter((l) => l.status !== 'planned').reverse()
  const subtitle = levelLabel(student) ?? student.note

  return (
    <Screen>
      <BackButton onClick={onBack}>{backLabel}</BackButton>

      <div className={s.head}>
        <Avatar name={student.name} size="large" />
        <div className={s.headText}>
          <PageTitle>{student.name}</PageTitle>
          {subtitle ? <span className={s.note}>{subtitle}</span> : null}
        </div>
      </div>

      {student.archived ? (
        <Note>Ученик в архиве: в списках его нет, история занятий и деньги сохранены.</Note>
      ) : null}

      <InfoList>
        <InfoRow label="Цена за занятие">{formatMoney(student.price)}</InfoRow>
        <InfoRow label="Проведено всего">{doneCount}</InfoRow>
        <InfoRow label="Должен" tone={owed > 0 ? 'danger' : undefined}>{formatMoney(owed)}</InfoRow>
        {student.username ? <InfoRow label="Telegram" tone="link">@{student.username}</InfoRow> : null}
      </InfoList>

      {student.archived ? null : (
        <>
          <InviteStudent
            student={student}
            onInvite={onInvite}
            onNotify={onNotify}
            inviteLink={inviteLink}
          />

          <EditStudentLevel student={student} onChange={onUpdateStudent} />

          <NotifySettings student={student} onChange={onUpdateNotify} />
        </>
      )}

      <Section title="Ближайшие занятия">
        {upcoming.length === 0 ? (
          <EmptyState>Запланированных занятий нет.</EmptyState>
        ) : (
          <Group>
            {upcoming.map((l) => (
              <GroupRow
                key={l.id}
                title={dayTitle(l.date)}
                trailing={<span className={s.time}>{l.time}</span>}
                onClick={() => onOpenLesson(l.id)}
              />
            ))}
          </Group>
        )}
      </Section>

      {history.length > 0 ? (
        <Section title="История занятий">
          <Group>
            {history.map((l) => (
              <GroupRow
                key={l.id}
                title={dayTitle(l.date)}
                subtitle={
                  l.status === 'cancelled' ? 'Отменено' : l.paid ? 'Оплачено' : 'Ждём оплату'
                }
                trailing={<span className={s.time}>{l.time}</span>}
                onClick={() => onOpenLesson(l.id)}
              />
            ))}
          </Group>
        </Section>
      ) : null}

      {student.archived ? (
        <Actions>
          <Button onClick={() => onRestore(student.id)}>Вернуть из архива</Button>
        </Actions>
      ) : (
        <Actions>
          <Button onClick={() => onAddLesson(student.id)}>+ Добавить занятие</Button>
          <ContactStudent student={student} upcoming={upcoming} owed={owed} onNotify={onNotify} />
          <Button variant="secondary" onClick={() => setEditing(true)}>Изменить имя и цену</Button>
          {/* Удалить насовсем можно только ученика без занятий; с занятиями — архив, чтобы не потерять деньги */}
          {own.length === 0 ? (
            <Button variant="danger" onClick={() => onDelete(student.id)}>Удалить ученика</Button>
          ) : (
            <Button variant="danger" onClick={() => setArchiving(true)}>Убрать в архив</Button>
          )}
        </Actions>
      )}

      {editing ? (
        <EditStudentSheet student={student} onSave={onUpdateStudent} onClose={() => setEditing(false)} />
      ) : null}

      {archiving ? (
        <Sheet
          title="Убрать в архив?"
          subtitle={`${student.name} исчезнет из списков. Будущие занятия удалятся, повтор «каждую неделю» остановится. Прошедшие занятия и деньги останутся, ученика можно вернуть.`}
          onClose={() => setArchiving(false)}
        >
          <Button
            variant="danger"
            className={s.confirm}
            onClick={() => {
              setArchiving(false)
              onArchive(student.id)
            }}
          >
            Убрать в архив
          </Button>
          <Button variant="secondary" onClick={() => setArchiving(false)}>Оставить</Button>
        </Sheet>
      ) : null}
    </Screen>
  )
}
