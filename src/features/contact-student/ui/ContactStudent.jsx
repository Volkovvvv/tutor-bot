import { openChat, shareText } from '../../../shared/api/telegram.js'
import { debtMessage, scheduleMessage } from '../model/messages.js'
import { Button } from '../../../shared/ui/index.js'

// Кнопки связи с учеником: открыть чат или отправить готовый текст
// через системный выбор чата Telegram
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
      {canOpen ? (
        <Button variant="secondary" onClick={write}>
          Написать в Telegram
        </Button>
      ) : null}
      <Button variant="secondary" onClick={() => send(scheduleMessage(student, upcoming))}>
        Отправить расписание
      </Button>
      {owed > 0 ? (
        <Button variant="secondary" onClick={() => send(debtMessage(student, owed))}>
          Напомнить про оплату
        </Button>
      ) : null}
    </>
  )
}
