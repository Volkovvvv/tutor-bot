import { useEffect, useRef } from 'react'
import { cx } from '../../lib/cx.js'
import s from './TabBar.module.css'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Нижнее меню разделов. items: [{ value, label }]
export default function TabBar({ items, value, onChange }) {
  const index = Math.max(0, items.findIndex((item) => item.value === value))
  const thumbRef = useRef(null)
  const prevIndex = useRef(index)

  // «Капля» на лету чуть растягивается и сплющивается — как жидкость.
  // Отдельное свойство scale не конфликтует с transform, которым
  // её двигает CSS-переход, поэтому оба эффекта складываются.
  useEffect(() => {
    if (prevIndex.current === index) return
    prevIndex.current = index
    if (reducedMotion()) return
    thumbRef.current?.animate?.(
      [{ scale: '1 1' }, { scale: '1.18 0.9', offset: 0.35 }, { scale: '1 1' }],
      { duration: 450, easing: 'ease-out' }
    )
  }, [index])

  return (
    <div
      className={s.bar}
      role="tablist"
      aria-label="Разделы"
      style={{ '--count': items.length, '--index': index }}
    >
      <span ref={thumbRef} className={s.thumb} aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={cx(s.tab, value === item.value && s.active)}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
