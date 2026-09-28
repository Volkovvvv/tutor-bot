import s from './PageTitle.module.css'

export default function PageTitle({ children }) {
  return <h1 className={s.title}>{children}</h1>
}
