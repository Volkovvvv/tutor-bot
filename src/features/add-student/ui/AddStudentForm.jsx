import { useCallback, useState } from 'react'
import { GOAL_OPTIONS, GRADES } from '../../../entities/student/index.js'
import {
  BackButton,
  Field,
  Input,
  MainButton,
  PageTitle,
  Row,
  Screen,
  Select,
} from '../../../shared/ui/index.js'

export default function AddStudentForm({ defaultPrice, onSave, onCancel }) {
  const [name, setName] = useState('')
  // Цена из профиля репетитора — обычно она у всех учеников одна
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : '')

  // Класс и цель нужны материалам урока; можно заполнить позже в карточке
  const [grade, setGrade] = useState('')
  const [goal, setGoal] = useState('SCHOOL')

  const valid = name.trim().length > 0 && Number(price) > 0

  const save = useCallback(() => {
    if (!(name.trim().length > 0 && Number(price) > 0)) return
    onSave({ name: name.trim(), price: Number(price), grade: grade ? Number(grade) : null, goal })
  }, [name, price, grade, goal, onSave])

  return (
    <Screen>
      <BackButton onClick={onCancel} />
      <PageTitle>Новый ученик</PageTitle>

      <Field label="Имя">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Аня Петрова"
          autoFocus
        />
      </Field>

      <Field label="Цена за занятие, ₽">
        <Input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="1500"
        />
      </Field>

      <Row>
        <Field label="Класс">
          <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Не указан</option>
            {GRADES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label="Цель">
          <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </Row>

      <MainButton text="Сохранить" onClick={save} disabled={!valid} />
    </Screen>
  )
}
