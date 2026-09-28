import { INVITE_STATUS } from '../../../entities/student/index.js'
import { StudentList } from '../../../widgets/student-list/index.js'
import { Actions, Button, PageTitle, Screen } from '../../../shared/ui/index.js'
import { plural } from '../../../shared/lib/format.js'

export default function StudentsPage({ students, lessons, onOpen, onAdd, onInvite }) {
  const connected = students.filter((s) => s.inviteStatus === INVITE_STATUS.accepted).length
  const summary = students.length
    ? `${students.length} ${plural(students.length, 'ученик', 'ученика', 'учеников')} · ${connected} ${plural(connected, 'подключён', 'подключены', 'подключены')} к боту`
    : null

  return (
    <Screen>
      <PageTitle subtitle={summary}>Ученики</PageTitle>

      <StudentList students={students} lessons={lessons} onOpen={onOpen} />

      <Actions>
        <Button onClick={onInvite}>Пригласить ученика</Button>
        <Button variant="secondary" onClick={onAdd}>+ Добавить вручную</Button>
      </Actions>
    </Screen>
  )
}
