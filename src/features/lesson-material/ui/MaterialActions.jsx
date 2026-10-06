import { useState } from 'react'
import { cx } from '../../../shared/lib/cx.js'
import s from './MaterialActions.module.css'

// Действия с готовым материалом — стеклянная панель, которая держится
// у нижнего края, пока лист на экране: до кнопок не надо листать.
// Редкие действия спрятаны в два меню. busy — что сейчас выполняется
export default function MaterialActions({
  busy,
  sent,
  hasAnswers,
  onDownload,
  onSend,
  onEditText,
  onChangeTopic,
  onDelete,
}) {
  // 'pdf' | 'more' | null — какое меню открыто
  const [menu, setMenu] = useState(null)
  const close = () => setMenu(null)
  const run = (action) => () => {
    close()
    action()
  }

  const downloading = busy === 'pdf' || busy === 'pdf-answers'
  // Без ответов выбирать не из чего — качаем сразу
  const onPdf = hasAnswers ? () => setMenu(menu === 'pdf' ? null : 'pdf') : () => onDownload(false)

  return (
    <>
      {menu ? <div className={s.backdrop} onClick={close} /> : null}
      <div className={s.bar}>
        {menu === 'pdf' ? (
          <div className={cx(s.menu, s.left)} role="menu">
            <button type="button" role="menuitem" className={s.item} onClick={run(() => onDownload(false))}>
              <span className={s.itemTitle}>Для ученика</span>
              <span className={s.itemHint}>Теория, пример и задачи</span>
            </button>
            <button type="button" role="menuitem" className={s.item} onClick={run(() => onDownload(true))}>
              <span className={s.itemTitle}>С ответами</span>
              <span className={s.itemHint}>Для вас, с решениями задач</span>
            </button>
          </div>
        ) : null}

        {menu === 'more' ? (
          <div className={cx(s.menu, s.right)} role="menu">
            <button type="button" role="menuitem" className={s.item} onClick={run(onChangeTopic)}>
              <span className={s.itemTitle}>Изменить тему</span>
            </button>
            <span className={s.divider} />
            <button type="button" role="menuitem" className={cx(s.item, s.danger)} onClick={run(onDelete)}>
              <span className={s.itemTitle}>Удалить занятие</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={s.main}
          onClick={onPdf}
          disabled={!!busy}
          aria-haspopup={hasAnswers ? 'menu' : undefined}
          aria-expanded={hasAnswers ? menu === 'pdf' : undefined}
        >
          <span>{downloading ? 'Готовлю файл…' : 'Скачать PDF'}</span>
          {hasAnswers && !downloading ? (
            <svg className={cx(s.chevron, menu === 'pdf' && s.open)} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>

        <button
          type="button"
          className={cx(s.round, sent && s.done)}
          onClick={run(onSend)}
          disabled={!!busy}
          aria-label={sent ? 'PDF отправлен в Telegram — отправить ещё раз' : 'Прислать PDF в Telegram'}
        >
          {busy === 'send' ? (
            <span className={s.spinner} />
          ) : sent ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" />
              <path d="m10 13 4.5-4.5" />
            </svg>
          )}
        </button>

        <button type="button" className={s.round} onClick={run(onEditText)} disabled={!!busy} aria-label="Редактировать текст">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 4.5 19.5 9 8 20.5H3.5V16L15 4.5Z" />
          </svg>
        </button>

        <button
          type="button"
          className={cx(s.round, menu === 'more' && s.pressed)}
          onClick={() => setMenu(menu === 'more' ? null : 'more')}
          disabled={!!busy}
          aria-label="Ещё"
          aria-haspopup="menu"
          aria-expanded={menu === 'more'}
        >
          <span className={s.dot} />
          <span className={s.dot} />
          <span className={s.dot} />
        </button>
      </div>
    </>
  )
}
