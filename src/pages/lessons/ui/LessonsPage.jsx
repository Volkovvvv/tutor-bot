import { MonthSummary } from '../../../widgets/month-summary/index.js'
import { LessonList } from '../../../widgets/lesson-list/index.js'
import { Actions, Button, PageTitle, Screen } from '../../../shared/ui/index.js'

export default function LessonsPage({ students, lessons, onOpen, onAdd }) {
  return (
    <Screen>
      <MonthSummary lessons={lessons} students={students} />

      <PageTitle>Занятия</PageTitle>

      <LessonList lessons={lessons} students={students} onOpen={onOpen} />

      <Actions>
        <Button onClick={onAdd}>+ Добавить занятие</Button>
      </Actions>
    </Screen>
  )
}
