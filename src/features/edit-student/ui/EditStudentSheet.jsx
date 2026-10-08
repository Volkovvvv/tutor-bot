import { useState } from 'react'
import { currencySign } from '../../../shared/lib/format.js'
import { Button, Field, Input, Sheet } from '../../../shared/ui/index.js'

/**
 * Имя и цена ученика. Новая цена действует на занятия, которые будут созданы
 * после правки: у уже созданных цена зафиксирована (её можно поменять в самом занятии).
 */
export default function EditStudentSheet({ student, onSave, onClose }) {
  const [name, setName] = useState(student.name)
  const [price, setPrice] = useState(String(student.price))

  const valid = name.trim().length > 0 && Number(price) > 0

  const save = () => {
    if (!valid) return
    onSave(student.id, { name: name.trim(), price: Number(price) })
    onClose()
  }

  return (
    <Sheet
      title="Изменить ученика"
      subtitle="Новая цена — для следующих занятий. У уже созданных она меняется в самом занятии."
      onClose={onClose}
    >
      <Field label="Имя">
        <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={`Цена за занятие, ${currencySign()}`}>
        <Input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
          placeholder="1500"
        />
      </Field>
      <Button onClick={save} disabled={!valid}>Сохранить</Button>
    </Sheet>
  )
}
