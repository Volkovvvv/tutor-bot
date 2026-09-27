import { useCallback, useState } from 'react'
import MainButton from '../../../shared/ui/MainButton.jsx'
import { shareText } from '../../../shared/api/telegram.js'

/**
 * «Пригласить ученика»: создаёт карточку и сразу приглашение, затем
 * открывает нативный пикер чатов Telegram с готовым текстом.
 *
 * Telegram не даёт мини-аппу список чатов пользователя — такого метода
 * нет ни в WebApp SDK, ни в Bot API, это ограничение приватности
 * платформы. Поэтому выбор получателя идёт через switchInlineQuery
 * (тот же системный пикер, что и в carточке ученика), а не через список
 * контактов внутри приложения.
 */
export default function ImportFromTelegram({ onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [sending, setSending] = useState(false)

  const valid = name.trim().length > 0 && Number(price) > 0

  const send = useCallback(async () => {
    if (!(name.trim().length > 0 && Number(price) > 0) || sending) return
    setSending(true)
    const result = await onCreate({ name: name.trim(), price: Number(price) })
    setSending(false)
    if (!result) return // ошибка уже показана через reportError в useStore

    const shared = shareText(result.message)
    // shareText сам открывает пикер (shared) или копирует текст в буфер
    // (copied) — дальше решать репетитору, куда его вставить.
    onCancel()
    return shared
  }, [name, price, sending, onCreate, onCancel])

  return (
    <>
      <button className="back" onClick={onCancel}>← Назад</button>
      <h1>Пригласить ученика</h1>

      <div className="note">
        Telegram не даёт приложению доступ к списку ваших чатов — это
        ограничение приватности платформы. Укажите имя и цену, а получателя
        выберете на следующем шаге в системном окне выбора чата.
      </div>

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

      <MainButton
        text={sending ? 'Отправляем…' : 'Выбрать чат и отправить'}
        onClick={send}
        disabled={!valid || sending}
      />
    </>
  )
}
