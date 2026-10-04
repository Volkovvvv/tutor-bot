import { cx } from '../../lib/cx.js'
import s from './Field.module.css'

// Подпись над контролом. <label> оборачивает контрол — клик по подписи ставит фокус.
export function Field({ label, children }) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      {children}
    </label>
  )
}

// Для полей, где контролов несколько (чипсы, «с — до»): подпись без <label>
export function FieldGroup({ label, children }) {
  return (
    <div className={s.field} role="group" aria-label={label}>
      <span className={s.label}>{label}</span>
      {children}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cx(s.control, className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea className={cx(s.control, s.textarea, className)} rows={rows} {...props} />
}

export function Select({ className, ...props }) {
  return <select className={cx(s.control, s.select, className)} {...props} />
}
