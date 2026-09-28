import { openChat, shareText } from '../../../shared/api/telegram.js'
import { debtMessage, scheduleMessage } from '../model/messages.js'
import { Button, Note, Section } from '../../../shared/ui/index.js'

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
    <Section title="Связь с учеником">
      <Button onClick={write} disabled={!canOpen}>
        Написать в Telegram
      </Button>
      <Button variant="secondary" onClick={() => send(scheduleMessage(student, upcoming))}>
        Отправить расписание
      </Button>
      {owed > 0 ? (
        <Button variant="secondary" onClick={() => send(debtMessage(student, owed))}>
          Напомнить про оплату
        </Button>
      ) : null}
      {!canOpen ? (
        <Note>
          Ученик добавлен вручную — чтобы писать ему из приложения, добавьте его
          через «Выбрать из Telegram».
        </Note>
      ) : null}
    </Section>
  )
}
