import { cx } from '../../lib/cx.js'
import s from './Switch.module.css'

export default function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx(s.switch, checked && s.on)}
      onClick={() => onChange(!checked)}
    >
      <span className={s.knob} />
    </button>
  )
}
