import { openChat, shareText } from '../../../shared/api/telegram.js'
import { debtMessage, scheduleMessage } from '../model/messages.js'

// Кнопки связи с учеником. Реальную отправку от имени бота добавим,
// когда появится бэкенд; пока открываем чат и передаём готовый текст.
export default function ContactStudent({ student, upcoming, owed, onNotify }) {
  const canOpen = Boolean(student.username || student.tgId)

  const write = () => {
    const ok = openChat(student)
    onNotify(ok ? 'Открываем чат…' : 'У ученика не указан username')
  }

  const send = (text) => {
    const result = shareText(text)
    if (result === 'shared') onNotify('Выберите чат для отправки')
    else if (result === 'copied') onNotify('Текст скопирован')
    else onNotify('Не удалось подготовить сообщение')
  }

  return (
    <>
      <div className="section-title">Связь с учеником</div>
      <div className="actions">
        <button className="btn" onClick={write} disabled={!canOpen}>
          Написать в Telegram
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => send(scheduleMessage(student, upcoming))}
        >
          Отправить расписание
        </button>
        {owed > 0 ? (
          <button
            className="btn btn-secondary"
            onClick={() => send(debtMessage(student, owed))}
          >
            Напомнить про оплату
          </button>
        ) : null}
      </div>
      {!canOpen ? (
        <div className="note" style={{ marginTop: 10 }}>
          Ученик добавлен вручную — чтобы писать ему из приложения, добавьте его
          через «Выбрать из Telegram».
        </div>
      ) : null}
    </>
  )
}
