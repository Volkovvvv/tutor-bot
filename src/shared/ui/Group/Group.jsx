import Card from '../Card/Card.jsx'
import s from './Group.module.css'

// Одна белая карточка со строками через тонкий разделитель
export function Group({ children }) {
  return <Card className={s.group}>{children}</Card>
}

/**
 * Строка группы: заголовок / подзаголовок слева, trailing справа.
 * С onClick строка становится кнопкой.
 */
export function GroupRow({ title, subtitle, trailing, onClick }) {
  const body = (
    <>
      <div className={s.main}>
        <div className={s.title}>{title}</div>
        {subtitle ? <div className={s.subtitle}>{subtitle}</div> : null}
      </div>
      {trailing ? <div className={s.trailing}>{trailing}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={s.row} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={s.row}>{body}</div>
}
