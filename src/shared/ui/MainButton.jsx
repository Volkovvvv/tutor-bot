import { useEffect } from 'react'
import { tg } from '../api/telegram.js'

// Управляет Telegram.MainButton. Когда Telegram недоступен, рендерит обычную кнопку,
// иначе вне Telegram форму было бы нечем отправить.
export default function MainButton({ text, onClick, disabled = false }) {
  useEffect(() => {
    const mb = tg?.MainButton
    if (!mb) return
    mb.setText(text)
    mb.onClick(onClick)
    mb.show()
    if (disabled) mb.disable()
    else mb.enable()
    return () => {
      mb.offClick(onClick)
      mb.hide()
    }
  }, [text, onClick, disabled])

  if (tg?.MainButton) return null

  return (
    <button className="btn" onClick={onClick} disabled={disabled} style={{ marginTop: 20 }}>
      {text}
    </button>
  )
}
