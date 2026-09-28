import { cx } from '../../lib/cx.js'
import Card from '../Card/Card.jsx'
import s from './InfoList.module.css'

// Карточка «параметр — значение»: цена, долг, дата занятия
export function InfoList({ children }) {
  return <Card className={s.list}>{children}</Card>
}

/** tone: default | danger (долг) | link (username) */
export function InfoRow({ label, tone, children }) {
  return (
    <div className={s.row}>
      <span>{label}</span>
      <b className={cx(s.value, tone && s[tone])}>{children}</b>
    </div>
  )
}
