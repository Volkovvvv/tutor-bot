import { useState } from 'react'
import { currencySign } from '../../../shared/lib/format.js'
import { Button, Field, FieldGroup, Input, Row, Segmented, Sheet } from '../../../shared/ui/index.js'

const DURATIONS = [45, 60, 90, 120].map((value) => ({ value, label: `${value} мин` }))

/**
 * Перенос занятия, его длительность и цена. Меняется только это занятие:
 * остальные занятия той же серии «каждую неделю» остаются на своих местах.
 */
export default function EditLessonSheet({ lesson, price, onSave, onClose }) {
  const [date, setDate] = useState(lesson.date)
  const [time, setTime] = useState(lesson.time)
  const [duration, setDuration] = useState(lesson.duration ?? 60)
  const [cost, setCost] = useState(String(price))

  // Цена может быть нулевой: пробное или подарочное занятие
  const valid = Boolean(date && time) && cost !== '' && Number(cost) >= 0

  const save = () => {
    if (!valid) return
    onSave(lesson.id, { date, time, duration, price: Number(cost) })
    onClose()
  }

  return (
    <Sheet
      title="Изменить занятие"
      subtitle={lesson.seriesId ? 'Изменится только это занятие, остальные по расписанию — нет.' : undefined}
      onClose={onClose}
    >
      <Row>
        <Field label="Дата">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Время">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </Row>
      <FieldGroup label="Длительность">
        <Segmented label="Длительность" options={DURATIONS} value={duration} onChange={setDuration} />
      </FieldGroup>
      <Field label={`Цена, ${currencySign()}`}>
        <Input
          inputMode="numeric"
          value={cost}
          onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))}
          placeholder="1500"
        />
      </Field>
      <Button onClick={save} disabled={!valid}>Сохранить</Button>
    </Sheet>
  )
}
