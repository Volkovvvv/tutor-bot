import { useEffect, useState } from 'react'
import { nowMinutes, todayISO } from './date.js'

// Текущие дата и минуты от полуночи, обновляются раз в минуту:
// «следующее занятие» и линия «сейчас» в календаре должны двигаться сами
export function useNow() {
  const read = () => ({ date: todayISO(), minutes: nowMinutes() })
  const [now, setNow] = useState(read)

  useEffect(() => {
    const id = setInterval(() => setNow(read()), 60_000)
    return () => clearInterval(id)
  }, [])

  return now
}
