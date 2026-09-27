import { useCallback, useState } from 'react'
import MainButton from '../../../shared/ui/MainButton.jsx'
import { todayISO } from '../../../shared/lib/date.js'

export default function AddLessonForm({ students, onSave, onCancel, presetStudentId }) {
  const [studentId, setStudentId] = useState(presetStudentId || students[0]?.id || '')
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('16:00')

  const valid = Boolean(studentId && date && time)

  const save = useCallback(() => {
    if (!(studentId && date && time)) return
    onSave({ studentId, date, time })
  }, [studentId, date, time, onSave])

  if (students.length === 0) {
    return (
      <>
        <button className="back" onClick={onCancel}>← Назад</button>
        <h1>Новое занятие</h1>
        <div className="empty">Сначала добавьте хотя бы одного ученика.</div>
      </>
    )
  }

  return (
    <>
      <button className="back" onClick={onCancel}>← Назад</button>
      <h1>Новое занятие</h1>

      <div className="field">
        <label>Ученик</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="row-2">
        <div className="field">
          <label>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Время</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <MainButton text="Сохранить" onClick={save} disabled={!valid} />
    </>
  )
}
