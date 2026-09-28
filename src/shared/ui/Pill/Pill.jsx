import { cx } from '../../lib/cx.js'
import s from './Pill.module.css'

export default function Pill({ as: Tag = 'span', className, children }) {
  return <Tag className={cx(s.pill, className)}>{children}</Tag>
}
