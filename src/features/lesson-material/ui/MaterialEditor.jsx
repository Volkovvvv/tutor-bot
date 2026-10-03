import { memo, useReducer } from 'react'
import { Button, Stack } from '../../../shared/ui/index.js'
import { draftReducer, fromDraft, isValidDraft, toDraft } from '../model/draft.js'
import s from './MaterialEditor.module.css'

// Поле, которое растёт вместе с текстом. Высоту задаёт невидимая копия
// текста в той же ячейке грида — без измерений DOM на каждый ввод.
function Area({ value, onChange, placeholder, label, strong }) {
  return (
    <div className={s.grow} data-value={value}>
      <textarea
        className={strong ? s.areaStrong : s.area}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  )
}

function Remove({ onClick, label }) {
  return (
    <button type="button" className={s.remove} onClick={onClick} aria-label={label}>
      ×
    </button>
  )
}

// Строки списков мемоизированы, а dispatch стабилен: набор текста
// в одном поле перерисовывает одну строку, а не весь редактор.
const TheoryRow = memo(function TheoryRow({ item, dispatch }) {
  const set = (patch) => dispatch({ type: 'item', list: 'theory', id: item.id, patch })
  return (
    <div className={s.row}>
      <div className={s.fields}>
        <Area strong value={item.h} onChange={(h) => set({ h })} placeholder="Заголовок" label="Заголовок блока" />
        <Area value={item.p} onChange={(p) => set({ p })} placeholder="Правило или формула" label="Текст блока" />
        <Area value={item.ex} onChange={(ex) => set({ ex })} placeholder="Мини-пример (необязательно)" label="Мини-пример" />
      </div>
      <Remove label="Удалить блок теории" onClick={() => dispatch({ type: 'remove', list: 'theory', id: item.id })} />
    </div>
  )
})

const MistakeRow = memo(function MistakeRow({ item, dispatch }) {
  return (
    <div className={s.row}>
      <div className={s.fields}>
        <Area
          value={item.text}
          onChange={(text) => dispatch({ type: 'item', list: 'mistakes', id: item.id, patch: { text } })}
          placeholder="Что делают неправильно и как надо"
          label="Типичная ошибка"
        />
      </div>
      <Remove label="Удалить ошибку" onClick={() => dispatch({ type: 'remove', list: 'mistakes', id: item.id })} />
    </div>
  )
})

const HomeworkRow = memo(function HomeworkRow({ item, number, dispatch }) {
  const set = (patch) => dispatch({ type: 'item', list: 'homework', id: item.id, patch })
  return (
    <div className={s.row}>
      <span className={s.number}>{number}</span>
      <div className={s.fields}>
        {item.tag ? <span className={s.tag}>{item.tag}</span> : null}
        <Area value={item.task} onChange={(task) => set({ task })} placeholder="Условие задания" label={`Задание ${number}`} />
        <Area
          value={item.answer}
          onChange={(answer) => set({ answer })}
          placeholder="Ответ для репетитора"
          label={`Ответ к заданию ${number}`}
        />
      </div>
      <Remove label={`Удалить задание ${number}`} onClick={() => dispatch({ type: 'remove', list: 'homework', id: item.id })} />
    </div>
  )
})

function Add({ onClick, children }) {
  return (
    <button type="button" className={s.add} onClick={onClick}>
      {children}
    </button>
  )
}

// Правка материала перед отправкой: ИИ ошибается, а отвечает репетитор
export default function MaterialEditor({ material, saving, onSave, onCancel }) {
  // toDraft — инициализатор: черновик собирается один раз, а не на каждый рендер
  const [draft, dispatch] = useReducer(draftReducer, material, toDraft)

  return (
    <Stack>
      <div className={s.card}>
        <Area
          strong
          value={draft.title}
          onChange={(value) => dispatch({ type: 'title', value })}
          placeholder="Заголовок"
          label="Заголовок материала"
        />

        <div className={s.label}>Теория</div>
        {draft.theory.map((item) => (
          <TheoryRow key={item.id} item={item} dispatch={dispatch} />
        ))}
        <Add onClick={() => dispatch({ type: 'add', list: 'theory' })}>+ Блок теории</Add>

        <div className={s.label}>Типичные ошибки</div>
        {draft.mistakes.map((item) => (
          <MistakeRow key={item.id} item={item} dispatch={dispatch} />
        ))}
        <Add onClick={() => dispatch({ type: 'add', list: 'mistakes' })}>+ Ошибка</Add>

        <div className={s.label}>Разбор примера</div>
        <Area
          strong
          value={draft.example.task}
          onChange={(task) => dispatch({ type: 'example', patch: { task } })}
          placeholder="Условие"
          label="Условие примера"
        />
        <Area
          value={draft.example.solution}
          onChange={(solution) => dispatch({ type: 'example', patch: { solution } })}
          placeholder="Решение по шагам"
          label="Решение примера"
        />

        <div className={s.label}>Домашнее задание</div>
        {draft.homework.map((item, i) => (
          <HomeworkRow key={item.id} item={item} number={i + 1} dispatch={dispatch} />
        ))}
        <Add onClick={() => dispatch({ type: 'add', list: 'homework' })}>+ Задание</Add>
      </div>

      <Button onClick={() => onSave(fromDraft(draft))} disabled={saving || !isValidDraft(draft)}>
        {saving ? 'Сохраняю…' : 'Сохранить правки'}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Отмена
      </Button>
    </Stack>
  )
}
