import { memo, useState } from 'react'
import s from './MaterialPreview.module.css'

// Материал листом PDF — таким его получит ученик. Ответы и пометки
// проверки видит только репетитор: в файле ученика их нет.
// pill, meta и footer — шапка и подпись листа, как в самом PDF
function MaterialPreview({ material, pill, meta, footer }) {
  const [showAnswers, setShowAnswers] = useState(false)
  const hasAnswers = material.homework.some((h) => h.answer)

  return (
    <article className={s.sheet}>
      <header className={s.head}>
        {pill ? <span className={s.pill}>{pill}</span> : null}
        <h3 className={s.topic}>{material.title ?? material.topic}</h3>
        {meta ? <div className={s.meta}>{meta}</div> : null}
      </header>

      <div className={s.body}>
        <div className={s.label}>01 · Теория</div>
        {material.theory.map((block, i) => (
          <div key={i} className={s.block}>
            <div className={s.h}>{block.h}</div>
            <p className={s.p}>{block.p}</p>
            {block.rule ? <p className={s.rule}>{block.rule}</p> : null}
            {block.ex ? <p className={s.ex}>{block.ex}</p> : null}
          </div>
        ))}

        {material.mistakes.length > 0 ? (
          <div className={s.block}>
            <div className={s.h}>Типичные ошибки</div>
            <ul className={s.mistakes}>
              {material.mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={s.label}>02 · Разбор примера</div>
        <div className={s.example}>
          <div className={s.h}>{material.example.task}</div>
          <p className={s.p}>{material.example.solution}</p>
          {material.example.doubt ? <p className={s.doubt}>Проверьте решение: {material.example.doubt}</p> : null}
        </div>

        <div className={s.label}>03 · Домашнее задание</div>
        <ol className={s.homework}>
          {material.homework.map((item, i) => (
            <li key={i} className={s.task}>
              <span className={s.num}>{i + 1}</span>
              <div className={s.taskBody}>
                {item.tag ? <span className={s.tag}>{item.tag}</span> : null}
                <span>{item.task}</span>
                {showAnswers && item.answer ? <p className={s.answer}>Ответ: {item.answer}</p> : null}
                {item.doubt ? <p className={s.doubt}>Проверьте ответ: {item.doubt}</p> : null}
              </div>
            </li>
          ))}
        </ol>

        {hasAnswers ? (
          <button type="button" className={s.toggle} onClick={() => setShowAnswers((v) => !v)}>
            {showAnswers ? 'Скрыть ответы' : 'Показать ответы'}
          </button>
        ) : null}

        <footer className={s.foot}>
          <span>{footer}</span>
          <span>Вопросы — в Telegram</span>
        </footer>
      </div>
    </article>
  )
}

export default memo(MaterialPreview)
