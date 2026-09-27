import { StudentList } from '../../../widgets/student-list/index.js'

export default function StudentsPage({ students, lessons, onOpen, onAdd, onInvite }) {
  return (
    <>
      <h1>Ученики</h1>

      <StudentList students={students} lessons={lessons} onOpen={onOpen} />

      <div className="actions">
        <button className="btn" onClick={onInvite}>Пригласить ученика</button>
        <button className="btn btn-secondary" onClick={onAdd}>+ Добавить вручную</button>
      </div>
    </>
  )
}
