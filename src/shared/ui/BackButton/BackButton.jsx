import s from './BackButton.module.css'

export default function BackButton({ onClick, children = 'Назад' }) {
  return (
    <button type="button" className={s.back} onClick={onClick}>
      ← {children}
    </button>
  )
}
