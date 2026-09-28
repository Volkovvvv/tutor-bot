import s from './Note.module.css'

export default function Note({ children }) {
  return <div className={s.note}>{children}</div>
}
