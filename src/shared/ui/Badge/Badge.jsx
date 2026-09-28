import { cx } from '../../lib/cx.js'
import s from './Badge.module.css'

/**
 * tone: neutral | positive (лайм) | negative (красный) | paid (зелёный текст) | struck (зачёркнутый)
 * size: normal | small — в списке учеников под ценой
 */
export default function Badge({ tone = 'neutral', size = 'normal', children }) {
  return <span className={cx(s.badge, s[tone], size === 'small' && s.small)}>{children}</span>
}
