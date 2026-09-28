import s from './PageTitle.module.css'

// Белый заголовок экрана. subtitle — строка под ним (дата, сводка),
// action — кнопка справа («+ Занятие»)
export default function PageTitle({ subtitle, action, children }) {
  const title = <h1 className={s.title}>{children}</h1>
  if (!subtitle && !action) return title

  return (
    <div className={s.header}>
      <div className={s.text}>
        {title}
        {subtitle ? <span className={s.subtitle}>{subtitle}</span> : null}
      </div>
      {action}
    </div>
  )
}
