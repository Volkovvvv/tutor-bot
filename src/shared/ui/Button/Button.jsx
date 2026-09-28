import { cx } from '../../lib/cx.js'
import s from './Button.module.css'

/**
 * variant: primary — лаймовая, главное действие экрана;
 *          secondary — белая, второстепенные действия;
 *          danger — удаление.
 */
export default function Button({ variant = 'primary', type = 'button', className, ...props }) {
  return <button type={type} className={cx(s.button, s[variant], className)} {...props} />
}
