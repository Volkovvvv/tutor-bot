import { useCallback, useState } from 'react'
import { currencySign } from '../../../shared/lib/format.js'
import {
  BackButton,
  Field,
  Input,
  MainButton,
  Note,
  PageTitle,
  Screen,
} from '../../../shared/ui/index.js'
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
export default function ImportFromTelegram({ defaultPrice, onCreate, onCancel, onDone }) {
  const [name, setName] = useState('')
  // Цена из профиля репетитора — обычно она у всех учеников одна
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : '')
  const [sending, setSending] = useState(false)

  const valid = name.trim().length > 0 && Number(price) > 0

  const send = useCallback(async () => {
    if (!(name.trim().length > 0 && Number(price) > 0) || sending) return
    setSending(true)
    const result = await onCreate({ name: name.trim(), price: Number(price) })
    setSending(false)
    if (!result) return // ошибка уже показана через reportError в useStore

    const shared = shareText(result.message)
    // Ученик уже создан и приглашение выпущено — экран закрываем в любом
    // случае, но о судьбе сообщения сообщаем честно: если выбор чата
    // открыть не удалось, текст лежит в буфере и вставить его надо самому.
    onDone(
      shared === 'shared'
        ? 'Выберите чат ученика'
        : shared === 'copied'
          ? 'Приглашение скопировано — вставьте его в чат ученика'
          : 'Ученик создан. Ссылку можно отправить с его карточки'
    )
  }, [name, price, sending, onCreate, onDone])

  return (
    <Screen>
      <BackButton onClick={onCancel} />
      <PageTitle>Пригласить ученика</PageTitle>

      <Note>
        Укажите имя и цену — приложение создаст карточку ученика и подготовит
        приглашение. Дальше Telegram предложит выбрать чат, куда его отправить.
      </Note>

      <Field label="Имя">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, Аня Петрова"
          autoFocus
        />
      </Field>

      <Field label={`Цена за занятие, ${currencySign()}`}>
        <Input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="1500"
        />
      </Field>

      <MainButton
        text={sending ? 'Отправляем…' : 'Выбрать чат и отправить'}
        onClick={send}
        disabled={!valid || sending}
      />
    </Screen>
  )
}
