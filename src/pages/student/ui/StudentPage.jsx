import { LessonRow, studentLessons, upcomingLessons } from '../../../entities/lesson/index.js'
import { ContactStudent } from '../../../features/contact-student/index.js'
import { InviteStudent } from '../../../features/invite-student/index.js'
import { NotifySettings } from '../../../features/notify-settings/index.js'
import { formatDate } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'
import {
  Actions,
  BackButton,
  Button,
  EmptyState,
  InfoList,
  InfoRow,
  PageTitle,
  Screen,
  Section,
  Stack,
} from '../../../shared/ui/index.js'

export default function StudentPage({
  student,
  lessons,
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

  return (
    <Screen>
      <BackButton onClick={onBack}>Ученики</BackButton>
      <PageTitle>{student.name}</PageTitle>

      <InfoList>
        <InfoRow label="Цена за занятие">{formatMoney(student.price)}</InfoRow>
        <InfoRow label="Проведено всего">{doneCount}</InfoRow>
        <InfoRow label="Должен">{formatMoney(owed)}</InfoRow>
        {student.username ? <InfoRow label="Telegram">@{student.username}</InfoRow> : null}
      </InfoList>

      <InviteStudent
        student={student}
        onInvite={onInvite}
        onNotify={onNotify}
        inviteLink={inviteLink}
      />

      <NotifySettings student={student} onChange={onUpdateNotify} />

      <ContactStudent
        student={student}
        upcoming={upcoming}
        owed={owed}
        onNotify={onNotify}
      />

      <Section title="История занятий">
        {own.length === 0 ? (
          <EmptyState>Занятий пока нет.</EmptyState>
        ) : (
          <Stack>
            {own.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                title={formatDate(l.date)}
                subtitle={`в ${l.time}`}
                onClick={() => onOpenLesson(l.id)}
              />
            ))}
          </Stack>
        )}
      </Section>

      <Actions>
        <Button onClick={() => onAddLesson(student.id)}>+ Добавить занятие</Button>
        <Button variant="danger" onClick={() => onDelete(student.id)}>Удалить ученика</Button>
      </Actions>
    </Screen>
  )
}
