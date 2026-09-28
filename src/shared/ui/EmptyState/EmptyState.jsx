import s from './EmptyState.module.css'

// Пустое состояние — приглашает к действию, а не просто сообщает
export default function EmptyState({ icon, title, children }) {
  return (
    <div className={s.empty}>
      {icon ? <div className={s.icon}>{icon}</div> : null}
      {title ? <div className={s.title}>{title}</div> : null}
      {children}
    </div>
  )
}
