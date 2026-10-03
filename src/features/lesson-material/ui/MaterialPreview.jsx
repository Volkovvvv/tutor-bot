import { memo, useState } from 'react'
import s from './LessonMaterial.module.css'

// Материал в том виде, в каком его получит ученик, плюс ответы по кнопке
function MaterialPreview({ material }) {
  const [showAnswers, setShowAnswers] = useState(false)
  const hasAnswers = material.homework.some((h) => h.answer)

  return (
    <div className={s.card}>
      <div className={s.topic}>{material.title ?? material.topic}</div>

      {material.theory.map((block, i) => (
        <div key={i} className={s.block}>
          <div className={s.h}>{block.h}</div>
          <p className={s.p}>{block.p}</p>
          {block.rule ? <p className={s.rule}>{block.rule}</p> : null}
          {block.ex ? <p className={s.ex}>{block.ex}</p> : null}
        </div>
      ))}

      {material.mistakes.length > 0 ? (
        <>
          <div className={s.label}>Типичные ошибки</div>
          <ul className={s.list}>
            {material.mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </>
      ) : null}

      <div className={s.label}>Разбор примера</div>
      <div className={s.example}>
        <div className={s.h}>{material.example.task}</div>
        <p className={s.p}>{material.example.solution}</p>
      </div>

      <div className={s.label}>Домашнее задание</div>
      <ol className={s.list}>
        {material.homework.map((item, i) => (
          <li key={i}>
            {item.tag ? <span className={s.tag}>{item.tag}</span> : null}
            {item.task}
            {showAnswers && item.answer ? <p className={s.answer}>Ответ: {item.answer}</p> : null}
          </li>
        ))}
      </ol>

      {hasAnswers ? (
        <button type="button" className={s.toggle} onClick={() => setShowAnswers((v) => !v)}>
          {showAnswers ? 'Скрыть ответы' : 'Показать ответы'}
        </button>
      ) : null}
    </div>
  )
}

export default memo(MaterialPreview)
