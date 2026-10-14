import { useState } from 'react'
import { MAX_DURATION, MIN_DURATION, isValidDuration } from '../../lib/duration.js'
import ChipGroup from '../ChipGroup/ChipGroup.jsx'
import { Input } from '../Field/Field.jsx'
import s from './DurationField.module.css'

const PRESETS = [45, 60, 90, 120].map((value) => ({ value, label: `${value} мин` }))

/**
 * Длительность занятия: частые варианты чипсами, остальное — своим числом минут.
 * value — число или null, пока поле «своё» пустое; допустимость проверяет вызывающий
 * через isValidDuration (shared/lib/duration.js).
 */
export default function DurationField({ value, onChange }) {
  // Текст своего поля держим отдельно: «60», набранное руками, не должно
  // превращаться в нажатый чипс и стираться из поля.
  const [custom, setCustom] = useState(() =>
    value !== null && !PRESETS.some((p) => p.value === value) ? String(value) : ''
  )

  const pick = (minutes) => {
    setCustom('')
    onChange(minutes)
  }

  const type = (e) => {
    const text = e.target.value.replace(/\D/g, '').slice(0, 3)
    setCustom(text)
    onChange(text === '' ? null : Number(text))
  }

  const invalid = custom !== '' && !isValidDuration(Number(custom))

  return (
    <div className={s.root}>
      <ChipGroup options={PRESETS} value={custom === '' ? value : null} onChange={pick} />
      <Input
        inputMode="numeric"
        className={s.input}
        value={custom}
        onChange={type}
        placeholder="Другое, мин"
        aria-label="Своя длительность в минутах"
        aria-invalid={invalid}
      />
      {invalid ? (
        <span className={s.error}>
          От {MIN_DURATION} до {MAX_DURATION} минут
        </span>
      ) : null}
    </div>
  )
}
