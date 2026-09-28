import { cx } from '../../lib/cx.js'
import s from './Badge.module.css'

/** tone: neutral | positive (лайм) | negative (красный) | struck (зачёркнутый) */
export default function Badge({ tone = 'neutral', children }) {
  return <span className={cx(s.badge, s[tone])}>{children}</span>
}
