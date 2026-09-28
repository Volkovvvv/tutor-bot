import { cx } from '../../lib/cx.js'
import s from './Layout.module.css'

// Корневая оболочка приложения: ширина, отступы, фоновый декор
export function AppShell({ children }) {
  return <div className={s.shell}>{children}</div>
}

// Вертикальный стек с равными промежутками. Отступы между блоками
// задаёт родитель, а не сами блоки — компоненты не знают о соседях.
export function Stack({ gap = 10, className, style, children }) {
  return (
    <div className={cx(s.stack, className)} style={{ '--gap': `${gap}px`, ...style }}>
      {children}
    </div>
  )
}

// Корень экрана: крупные блоки идут через 16px
export function Screen({ children }) {
  return <Stack gap={16}>{children}</Stack>
}

// Группа кнопок внизу экрана или секции
export function Actions({ children }) {
  return <Stack className={s.actions}>{children}</Stack>
}

// Строка из равных колонок: дата + время, «с» + «до»
export function Row({ children }) {
  return <div className={s.row}>{children}</div>
}
