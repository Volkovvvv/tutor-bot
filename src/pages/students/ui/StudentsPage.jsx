import { StudentList } from '../../../widgets/student-list/index.js'
import { Actions, Button, PageTitle, Screen } from '../../../shared/ui/index.js'

export default function StudentsPage({ students, lessons, onOpen, onAdd, onInvite }) {
  return (
    <Screen>
      <PageTitle>Ученики</PageTitle>

      <StudentList students={students} lessons={lessons} onOpen={onOpen} />

      <Actions>
        <Button onClick={onInvite}>Пригласить ученика</Button>
        <Button variant="secondary" onClick={onAdd}>+ Добавить вручную</Button>
      </Actions>
    </Screen>
  )
}
