import { useCallback, useState } from 'react'
import {
  BackButton,
  EmptyState,
  Field,
  Input,
  MainButton,
  PageTitle,
  Row,
  Screen,
  Select,
} from '../../../shared/ui/index.js'
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
      <Screen>
        <BackButton onClick={onCancel} />
        <PageTitle>Новое занятие</PageTitle>
        <EmptyState>Сначала добавьте хотя бы одного ученика.</EmptyState>
      </Screen>
    )
  }

  return (
    <Screen>
      <BackButton onClick={onCancel} />
      <PageTitle>Новое занятие</PageTitle>

      <Field label="Ученик">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </Field>

      <Row>
        <Field label="Дата">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Время">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </Row>

      <MainButton text="Сохранить" onClick={save} disabled={!valid} />
    </Screen>
  )
}
