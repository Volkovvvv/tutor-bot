import { cx } from '../../lib/cx.js'
import s from './Card.module.css'

// Белая поверхность. С onClick становится кнопкой — с нажатием и доступностью.
export default function Card({ onClick, className, children }) {
  if (onClick) {
    return (
      <button type="button" className={cx(s.card, s.interactive, className)} onClick={onClick}>
        {children}
      </button>
    )
  }
  return <div className={cx(s.card, className)}>{children}</div>
}
