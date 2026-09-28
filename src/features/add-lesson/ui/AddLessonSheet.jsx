import { useState } from 'react'
import { lessonsOn } from '../../../entities/lesson/index.js'
import { addDays, dayTitle, parseISO, weekOf, weekdayShort } from '../../../shared/lib/date.js'
import { cx } from '../../../shared/lib/cx.js'
import { Button, EmptyState, Input, Sheet } from '../../../shared/ui/index.js'
import s from './AddLessonSheet.module.css'

// Самые частые слоты репетитора. Остальное — через «Другое время»
const TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

// Имя без фамилии, если оно однозначно среди учеников
function shortNames(students) {
  const first = (name) => name.split(' ')[0]
  const counts = new Map()
  for (const st of students) counts.set(first(st.name), (counts.get(first(st.name)) ?? 0) + 1)
  return new Map(students.map((st) => [st.id, counts.get(first(st.name)) > 1 ? st.name : first(st.name)]))
}

/**
 * Шторка «Новое занятие»: ученик, день и время — всё чипсами,
 * занятые слоты выбранного дня зачёркнуты.
 */
export default function AddLessonSheet({ students, lessons, date, studentId, onSave, onClose }) {
  const [pickedStudent, setPickedStudent] = useState(studentId ?? null)
  const [pickedDate, setPickedDate] = useState(date)
  const [time, setTime] = useState(null)

  // Две недели, начиная с понедельника недели исходной даты
  const days = [...weekOf(date), ...weekOf(addDays(date, 7))]
  const busy = new Set(
    lessonsOn(lessons, pickedDate)
      .filter((l) => l.status !== 'cancelled')
      .map((l) => l.time)
  )
  const names = shortNames(students)
  const valid = Boolean(pickedStudent && pickedDate && time && !busy.has(time))

  const save = () => {
    if (!valid) return
    onSave({ studentId: pickedStudent, date: pickedDate, time })
  }

  if (students.length === 0) {
    return (
      <Sheet title="Новое занятие" onClose={onClose}>
        <EmptyState>Сначала добавьте хотя бы одного ученика.</EmptyState>
      </Sheet>
    )
  }

  return (
    <Sheet title="Новое занятие" subtitle={dayTitle(pickedDate)} onClose={onClose}>
      <div className={s.block}>
        <span className={s.label}>Ученик</span>
        <div className={s.chips}>
          {students.map((st) => (
            <button
              key={st.id}
              type="button"
              aria-pressed={pickedStudent === st.id}
              className={cx(s.chip, pickedStudent === st.id && s.on)}
              onClick={() => setPickedStudent(st.id)}
            >
              {names.get(st.id)}
            </button>
          ))}
        </div>
      </div>

      <div className={s.block}>
        <span className={s.label}>День</span>
        <div className={s.days}>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={pickedDate === d}
              className={cx(s.day, pickedDate === d && s.on)}
              onClick={() => setPickedDate(d)}
            >
              <span className={s.dayWeek}>{weekdayShort(d)}</span>
              <span className={s.dayNum}>{parseISO(d).getDate()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={s.block}>
        <span className={s.label}>Время</span>
        <div className={s.times}>
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy.has(t)}
              aria-pressed={time === t}
              className={cx(s.time, time === t && s.on, busy.has(t) && s.busy)}
              onClick={() => setTime(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <label className={s.custom}>
          <span>Другое время</span>
          <Input
            type="time"
            className={s.customInput}
            value={time && !TIMES.includes(time) ? time : ''}
            onChange={(e) => setTime(e.target.value || null)}
          />
        </label>
      </div>

      <Button onClick={save} disabled={!valid}>
        Добавить
      </Button>
    </Sheet>
  )
}
