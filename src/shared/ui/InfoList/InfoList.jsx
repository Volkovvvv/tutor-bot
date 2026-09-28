import Card from '../Card/Card.jsx'
import s from './InfoList.module.css'

// Карточка «параметр — значение»: цена, долг, дата занятия
export function InfoList({ children }) {
  return <Card className={s.list}>{children}</Card>
}

export function InfoRow({ label, children }) {
  return (
    <div className={s.row}>
      <span>{label}</span>
      <b className={s.value}>{children}</b>
    </div>
  )
}
