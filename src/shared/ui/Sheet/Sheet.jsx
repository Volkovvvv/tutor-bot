import { useEffect } from 'react'
import s from './Sheet.module.css'

// Нижняя шторка поверх экрана. Закрывается тапом по затемнению и Escape
export default function Sheet({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className={s.backdrop} onClick={onClose} />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <span className={s.grip} />
        <div>
          <div className={s.title}>{title}</div>
          {subtitle ? <div className={s.subtitle}>{subtitle}</div> : null}
        </div>
        {children}
      </div>
    </>
  )
}
