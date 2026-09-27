import { useCallback, useState } from 'react'
import MainButton from '../../../shared/ui/MainButton.jsx'

export default function AddStudentForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  const valid = name.trim().length > 0 && Number(price) > 0

  const save = useCallback(() => {
    if (!(name.trim().length > 0 && Number(price) > 0)) return
    onSave({ name: name.trim(), price: Number(price) })
  }, [name, price, onSave])

  return (
    <>
      <button className="back" onClick={onCancel}>← Назад</button>
      <h1>Новый ученик</h1>

      <div className="field">
        <label>Имя</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Аня Петрова"
          autoFocus
        />
      </div>

      <div className="field">
        <label>Цена за занятие, ₽</label>
        <input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="1500"
        />
      </div>

      <MainButton text="Сохранить" onClick={save} disabled={!valid} />
    </>
  )
}
