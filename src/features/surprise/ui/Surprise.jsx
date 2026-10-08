import { useState } from 'react'
import { haptic, tg } from '../../../shared/api/telegram.js'
import { Button } from '../../../shared/ui/index.js'
import { looksLikeAnna, markSeen, wasSeen } from '../model/who.js'
import s from './Surprise.module.css'

// Сердечки летят снизу вверх: у каждого своя колонка, размер, задержка и скорость
const HEARTS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  size: 18 + ((i * 7) % 22),
  delay: `${(i * 0.37) % 4}s`,
  duration: `${5 + ((i * 3) % 4)}s`,
  char: i % 4 === 0 ? '💖' : i % 3 === 0 ? '💕' : '❤️',
}))

// #surprise в адресе — посмотреть сюрприз самому, не дожидаясь нужного человека
const forced = typeof window !== 'undefined' && window.location.hash.includes('surprise')

function shouldAsk(telegramName) {
  if (forced) return true
  if (wasSeen()) return false
  const user = tg?.initDataUnsafe?.user
  if (user) {
    return looksLikeAnna({ firstName: user.first_name, lastName: user.last_name, username: user.username })
  }
  const [firstName = '', ...rest] = (telegramName ?? '').split(' ')
  return looksLikeAnna({ firstName, lastName: rest.join(' ') })
}

/**
 * Сюрприз при входе: «Вас зовут Анна Волкова?» — и признание, если да.
 * Показывается один раз на устройстве.
 */
export default function Surprise({ telegramName }) {
  // 'ask' | 'love' | null
  const [step, setStep] = useState(() => (shouldAsk(telegramName) ? 'ask' : null))

  if (!step) return null

  const close = () => {
    markSeen()
    setStep(null)
  }

  if (step === 'ask') {
    return (
      <div className={s.backdrop}>
        <div className={s.card} role="dialog" aria-modal="true" aria-label="Вопрос">
          <div className={s.question}>Вас зовут Анна Волкова?</div>
          <div className={s.buttons}>
            <Button
              onClick={() => {
                haptic('medium')
                markSeen()
                setStep('love')
              }}
            >
              Да
            </Button>
            <Button variant="secondary" onClick={close}>
              Нет
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={s.backdrop} onClick={close}>
      <div className={s.hearts} aria-hidden="true">
        {HEARTS.map((h, i) => (
          <span
            key={i}
            className={s.heart}
            style={{ left: h.left, fontSize: h.size, animationDelay: h.delay, animationDuration: h.duration }}
          >
            {h.char}
          </span>
        ))}
      </div>
      <div className={s.card} role="dialog" aria-modal="true" aria-label="Сюрприз" onClick={(e) => e.stopPropagation()}>
        <div className={s.big}>❤️</div>
        <div className={s.love}>Ваш муж вас очень любит</div>
        <div className={s.text}>Вы самый лучший репетитор в мире!</div>
        <div className={s.kiss}>💋</div>
        <Button onClick={close}>Спасибо ❤️</Button>
      </div>
    </div>
  )
}
