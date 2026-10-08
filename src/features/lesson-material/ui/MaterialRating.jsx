import { useState } from 'react'
import { track } from '../../../shared/api/track.js'
import { ChipGroup } from '../../../shared/ui/index.js'
import s from './MaterialRating.module.css'

// Коды причин известны серверу (RATING_REASONS в api/src/events/event-names.ts)
const REASONS = [
  { value: 'content', label: 'Ошибки в содержании' },
  { value: 'level', label: 'Не та сложность' },
  { value: 'long', label: 'Слишком длинно' },
  { value: 'short', label: 'Слишком коротко' },
  { value: 'design', label: 'Оформление' },
]

// Оценка запоминается на устройстве: при каждом открытии урока спрашивать не нужно
function key(lessonId, version) {
  return `tutor-crm:rated:${lessonId}:${version}`
}

function wasRated(lessonId, version) {
  try {
    return localStorage.getItem(key(lessonId, version)) !== null
  } catch {
    return false
  }
}

function remember(lessonId, version) {
  try {
    localStorage.setItem(key(lessonId, version), '1')
  } catch {
    // приватный режим — спросим ещё раз, не страшно
  }
}

/**
 * «Материал вам понравился?» под готовым материалом.
 * 👍 уходит сразу; после 👎 спрашиваем причину — одним касанием или пропуском.
 * version — createdAt материала: пересобранный материал оценивается заново.
 */
export default function MaterialRating({ lessonId, version }) {
  // 'ask' | 'reason' | 'done'
  const [step, setStep] = useState(() => (wasRated(lessonId, version) ? 'done-silent' : 'ask'))

  if (step === 'done-silent') return null

  const send = (good, reason) => {
    track('material_rating', { lessonId, good, ...(reason ? { reason } : {}) })
    remember(lessonId, version)
    setStep('done')
  }

  if (step === 'done') return <div className={s.card}>Спасибо! Это помогает делать материалы лучше.</div>

  if (step === 'reason') {
    return (
      <div className={s.card}>
        <div className={s.title}>Что не так?</div>
        <ChipGroup options={REASONS} value={null} onChange={(reason) => send(false, reason)} />
        <button type="button" className={s.skip} onClick={() => send(false)}>
          Пропустить
        </button>
      </div>
    )
  }

  return (
    <div className={s.card}>
      <div className={s.title}>Материал вам понравился?</div>
      <div className={s.buttons}>
        <button type="button" className={s.choice} onClick={() => send(true)}>
          👍 Да
        </button>
        <button type="button" className={s.choice} onClick={() => setStep('reason')}>
          👎 Нет
        </button>
      </div>
    </div>
  )
}
