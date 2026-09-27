import { MonthSummary } from '../../../widgets/month-summary/index.js'
import { LessonList } from '../../../widgets/lesson-list/index.js'

export default function LessonsPage({ students, lessons, onOpen, onAdd }) {
  return (
    <>
      <MonthSummary lessons={lessons} students={students} />

      <h1>Занятия</h1>

      <LessonList lessons={lessons} students={students} onOpen={onOpen} />

      <div className="actions">
        <button className="btn btn-accent" onClick={onAdd}>+ Добавить занятие</button>
      </div>
    </>
  )
}
