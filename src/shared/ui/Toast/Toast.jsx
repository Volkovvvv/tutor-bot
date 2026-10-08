import { useEffect } from 'react'
import s from './Toast.module.css'

const LIMIT_KEYWORDS = ['лимит', 'исчерпан']

export default function Toast({ message, onHide }) {
  const isLimitError = LIMIT_KEYWORDS.some((kw) => message?.toLowerCase().includes(kw))

  useEffect(() => {
    if (!message || isLimitError) return
    const t = setTimeout(onHide, 2200)
    return () => clearTimeout(t)
  }, [message, onHide, isLimitError])

  if (!message) return null
  return (
    <div className={s.toast} role="status">
      <span className={s.text}>{message}</span>
      <button className={s.close} onClick={onHide} aria-label="Закрыть" type="button">
        ✕
      </button>
    </div>
  )
}
