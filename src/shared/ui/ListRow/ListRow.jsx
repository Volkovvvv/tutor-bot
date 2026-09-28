import Card from '../Card/Card.jsx'
import s from './ListRow.module.css'

/**
 * Строка списка на карточке: [leading] заголовок / подзаголовок / meta [trailing].
 * meta — дополнительные строки под подзаголовком (метки, статусы).
 */
export default function ListRow({ leading, title, subtitle, meta, trailing, onClick }) {
  return (
    <Card onClick={onClick}>
      <div className={s.row}>
        {leading}
        <div className={s.main}>
          <div className={s.title}>{title}</div>
          {subtitle ? <div className={s.subtitle}>{subtitle}</div> : null}
          {meta}
        </div>
        {trailing ? <div className={s.trailing}>{trailing}</div> : null}
      </div>
    </Card>
  )
}
