import { useEffect, useRef } from 'react'
import { tg } from '../api/telegram.js'

// Управляет Telegram.MainButton. Когда Telegram недоступен, рендерит обычную кнопку,
// иначе вне Telegram форму было бы нечем отправить.
export default function MainButton({ text, onClick, disabled = false }) {
  // Колбэк в ref: формы пересоздают его на каждый введённый символ
  // (useCallback зависит от полей). Если подписываться на него напрямую,
  // эффект каждый раз делает hide() + show() — кнопка мигает при вводе.
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    const mb = tg?.MainButton
    if (!mb) return
    const handler = () => onClickRef.current()
    mb.onClick(handler)
    mb.show()
    return () => {
      mb.offClick(handler)
      mb.hide()
    }
  }, [])

  // Текст и доступность меняются на месте, без пересоздания подписки.
  useEffect(() => {
    const mb = tg?.MainButton
    if (!mb) return
    mb.setText(text)
    if (disabled) mb.disable()
    else mb.enable()
  }, [text, disabled])

  if (tg?.MainButton) return null

  return (
    <button className="btn" onClick={onClick} disabled={disabled} style={{ marginTop: 20 }}>
      {text}
    </button>
  )
}
