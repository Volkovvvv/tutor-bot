import { useCallback, useState } from 'react'
import {
  BackButton,
  Field,
  Input,
  MainButton,
  PageTitle,
  Screen,
} from '../../../shared/ui/index.js'

export default function AddStudentForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  const valid = name.trim().length > 0 && Number(price) > 0

  const save = useCallback(() => {
    if (!(name.trim().length > 0 && Number(price) > 0)) return
    onSave({ name: name.trim(), price: Number(price) })
  }, [name, price, onSave])

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

      <MainButton text="Сохранить" onClick={save} disabled={!valid} />
    </Screen>
  )
}
