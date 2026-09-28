import { studentLessons, upcomingLessons } from '../../../entities/lesson/index.js'
import { ContactStudent } from '../../../features/contact-student/index.js'
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
  PageTitle,
  Screen,
  Section,
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
  onNotify,
  onInvite,
  inviteLink,
  onUpdateNotify,
}) {
  if (!student) return null

  const { lessons: own, doneCount, owed } = studentLessons(lessons, student)
  const upcoming = upcomingLessons(lessons, student.id)
  // Прошедшие и отменённые — свежие сверху
  const history = own.filter((l) => l.status !== 'planned').reverse()

  return (
    <Screen>
      <BackButton onClick={onBack}>{backLabel}</BackButton>

      <div className={s.head}>
        <Avatar name={student.name} size="large" />
        <div className={s.headText}>
          <PageTitle>{student.name}</PageTitle>
          {student.note ? <span className={s.note}>{student.note}</span> : null}
        </div>
      </div>

      <InfoList>
        <InfoRow label="Цена за занятие">{formatMoney(student.price)}</InfoRow>
        <InfoRow label="Проведено всего">{doneCount}</InfoRow>
        <InfoRow label="Должен" tone={owed > 0 ? 'danger' : undefined}>{formatMoney(owed)}</InfoRow>
        {student.username ? <InfoRow label="Telegram" tone="link">@{student.username}</InfoRow> : null}
      </InfoList>

      <InviteStudent
        student={student}
        onInvite={onInvite}
        onNotify={onNotify}
        inviteLink={inviteLink}
      />

      <NotifySettings student={student} onChange={onUpdateNotify} />

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

      <Actions>
        <Button onClick={() => onAddLesson(student.id)}>+ Добавить занятие</Button>
        <ContactStudent student={student} upcoming={upcoming} owed={owed} onNotify={onNotify} />
        <Button variant="danger" onClick={() => onDelete(student.id)}>Удалить ученика</Button>
      </Actions>
    </Screen>
  )
}
