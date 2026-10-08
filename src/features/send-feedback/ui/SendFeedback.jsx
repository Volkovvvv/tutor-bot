import { useState } from 'react'
import { api } from '../../../shared/api/client.js'
import { Button, Sheet, Textarea } from '../../../shared/ui/index.js'

/**
 * «Написать разработчику»: текст уходит боту-администратору вместе с названием
 * экрана, с которого написали. Отвечает разработчик лично в Telegram.
 */
export default function SendFeedback({ screen, onClose, onSent, onError }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      await api.post('/feedback', { text: text.trim(), screen })
      onSent('Спасибо! Сообщение отправлено разработчику')
    } catch (e) {
      onError(e.message)
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="Написать разработчику"
      subtitle="Что не так, чего не хватает или что понравилось. Я читаю всё и отвечаю в Telegram."
      onClose={onClose}
    >
      <Textarea
        rows={5}
        value={text}
        maxLength={2000}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="Например: в теории ошибка в формуле, задания слишком лёгкие"
      />
      <Button onClick={send} disabled={busy || text.trim().length < 2}>
        {busy ? 'Отправляем…' : 'Отправить'}
      </Button>
    </Sheet>
  )
}
