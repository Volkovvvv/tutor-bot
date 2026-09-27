import { useCallback, useEffect, useMemo, useState } from 'react'
import MainButton from '../../../shared/ui/MainButton.jsx'
import Avatar from '../../../shared/ui/Avatar.jsx'
import { fetchChats, IS_DEMO } from '../model/chats.js'

const DEFAULT_PRICE = '1500'

export default function ImportFromTelegram({ existingTgIds, onImport, onCancel }) {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  // tgId -> цена строкой (пустая строка = поле ещё не заполнено)
  const [picked, setPicked] = useState(() => new Map())

  useEffect(() => {
    let alive = true
    fetchChats()
      .then((list) => {
        if (!alive) return
        setChats(list)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // Уже добавленных не предлагаем повторно
  const available = useMemo(
    () => chats.filter((c) => !existingTgIds.has(c.tgId)),
    [chats, existingTgIds]
  )

  const toggle = useCallback((tgId) => {
    setPicked((prev) => {
      const next = new Map(prev)
      if (next.has(tgId)) next.delete(tgId)
      else next.set(tgId, DEFAULT_PRICE)
      return next
    })
  }, [])

  const setPrice = useCallback((tgId, value) => {
    setPicked((prev) => {
      if (!prev.has(tgId)) return prev
      const next = new Map(prev)
      next.set(tgId, value)
      return next
    })
  }, [])

  // Сохранять можно, только если у каждого выбранного указана цена > 0
  const valid = picked.size > 0 && [...picked.values()].every((p) => Number(p) > 0)

  const save = useCallback(() => {
    const byId = new Map(available.map((c) => [c.tgId, c]))
    const students = []
    for (const [tgId, price] of picked) {
      const chat = byId.get(tgId)
      if (!chat || !(Number(price) > 0)) continue
      students.push({
        name: chat.name,
        price: Number(price),
        tgId: chat.tgId,
        username: chat.username,
        source: 'telegram',
      })
    }
    if (students.length > 0) onImport(students)
  }, [picked, available, onImport])

  return (
    <>
      <button className="back" onClick={onCancel}>← Назад</button>
      <h1>Выбрать из Telegram</h1>

      {IS_DEMO ? (
        <div className="note">
          Telegram не открывает Mini App доступ к списку чатов — это ограничение
          приватности. Сейчас показан демонстрационный список. На втором этапе
          ученики появятся здесь после того, как напишут боту.
        </div>
      ) : null}

      {loading ? (
        <div className="empty">Загружаем…</div>
      ) : available.length === 0 ? (
        <div className="empty">Все доступные контакты уже добавлены.</div>
      ) : (
        available.map((c) => {
          const on = picked.has(c.tgId)
          return (
            <div key={c.tgId} className={`pick-row ${on ? 'on' : 'off'}`}>
              <button
                className="pick-check"
                onClick={() => toggle(c.tgId)}
                aria-label={on ? 'Убрать' : 'Выбрать'}
              >
                ✓
              </button>
              <Avatar name={c.name} />
              <div className="pick-main" onClick={() => toggle(c.tgId)}>
                <div className="pick-name">{c.name}</div>
                <div className="pick-username">{c.username ? `@${c.username}` : 'без username'}</div>
              </div>
              <input
                className="pick-price"
                type="number"
                inputMode="numeric"
                placeholder="₽"
                disabled={!on}
                value={on ? picked.get(c.tgId) : ''}
                onChange={(e) => setPrice(c.tgId, e.target.value)}
              />
            </div>
          )
        })
      )}

      <MainButton
        text={picked.size > 0 ? `Добавить (${picked.size})` : 'Добавить'}
        onClick={save}
        disabled={!valid}
      />
    </>
  )
}
