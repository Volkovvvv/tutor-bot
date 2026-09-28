import { cx } from '../../lib/cx.js'
import s from './Segmented.module.css'

// Переключатель «один из нескольких» в одну строку. options: [{ value, label }]
export default function Segmented({ options, value, onChange, label }) {
  return (
    <div className={s.group} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cx(s.option, value === o.value && s.on)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
