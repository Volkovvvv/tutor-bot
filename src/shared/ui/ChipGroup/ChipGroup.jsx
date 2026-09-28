import { cx } from '../../lib/cx.js'
import s from './ChipGroup.module.css'

// Выбор одного варианта из нескольких. options: [{ value, label }]
export default function ChipGroup({ options, value, onChange }) {
  return (
    <div className={s.group}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={cx(s.chip, value === o.value && s.on)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
