import { useEffect, useState } from 'react'
import { levelLabel } from '../../../entities/student/index.js'
import { api, API_URL } from '../../../shared/api/client.js'
import { downloadFile } from '../../../shared/api/telegram.js'
import { cx } from '../../../shared/lib/cx.js'
import { SUBJECTS } from '../../../shared/lib/subjects.js'
import {
  Button,
  Field,
  FieldGroup,
  Input,
  Note,
  Section,
  Segmented,
  Select,
  Textarea,
} from '../../../shared/ui/index.js'
import MaterialActions from './MaterialActions.jsx'
import MaterialEditor from './MaterialEditor.jsx'
import MaterialPreview from './MaterialPreview.jsx'
import s from './LessonMaterial.module.css'

const OTHER = '__other'

// Свои предметы репетитора — первыми, дальше остальные из коробки
function subjectChoices(mine) {
  return [...mine, ...SUBJECTS.filter((name) => !mine.includes(name))]
}

const COUNT_OPTIONS = [
  { value: 4, label: 'Коротко · 4' },
  { value: 6, label: 'Обычно · 6' },
  { value: 10, label: 'Много · 10' },
]

// Что показать, пока ИИ пишет. Сервер шагов не сообщает — это один запрос
// примерно на минуту, поэтому шаги идут по времени, а последний ждёт ответа.
const STEPS = ['Пишу теорию', 'Разбираю пример', 'Подбираю домашку', 'Верстаю PDF']
const STEP_AT_MS = [12000, 28000, 45000]

// Сколько ждать между запросами, пока сервер проверяет ответы
const CHECK_POLL_MS = 5000

// О проверке говорим, только когда она что-то нашла: «замечаний нет»
// репетитор прочтёт как «всё верно», а этого проверка не обещает
function checkNote(material) {
  const doubts =
    material.homework.filter((h) => h.doubt).length +
    material.theory.filter((b) => b.doubt).length +
    (material.example.doubt ? 1 : 0) +
    (material.theoryDoubt ? 1 : 0)
  if (doubts === 0) return null
  return 'Проверка отметила места, на которые стоит посмотреть, — они помечены ниже.'
}

const COUNTRY_OPTIONS = [
  { value: 'RU', label: 'Россия' },
  { value: 'BY', label: 'Беларусь' },
]

// Материал одного урока: список всех материалов с текстами растёт с каждой генерацией
const materialsPath = (lessonId) => `/materials?lessonId=${encodeURIComponent(lessonId)}`

function reportError(message) {
  window.dispatchEvent(new CustomEvent('api-error', { detail: message }))
}

// Материалы к занятию: тема → ИИ собирает конспект, пример и домашку
// с ответами → ученику уходит PDF без ответов, репетитору — с ответами.
export default function LessonMaterial({
  lessonId,
  student,
  subjects,
  onAddSubject,
  country,
  onSetCountry,
  onOpenStudent,
  // Подпись и дата на листе — как в самом PDF
  tutorName,
  date,
  onDelete,
}) {
  const [material, setMaterial] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(subjects[0] ?? SUBJECTS[0])
  // Предмет, которого нет в списке: вводится вручную
  const [customSubject, setCustomSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(6)
  // Пожелания к материалу: уходят в запрос к ИИ, на сервере не хранятся
  const [wishes, setWishes] = useState('')
  // Правка текста готового материала (не путать с editing — сменой темы)
  const [revising, setRevising] = useState(false)
  // 'generate' | 'save' | 'send' | 'pdf' | 'pdf-answers' | null — что сейчас выполняется
  const [busy, setBusy] = useState(null)
  const [sent, setSent] = useState(false)
  // Какой шаг показывать, пока ИИ пишет
  const [stage, setStage] = useState(0)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    setSent(false)
    setRevising(false)
    api
      .get(materialsPath(lessonId))
      .then((list) => {
        if (!alive) return
        setMaterial(list.find((m) => m.lessonId === lessonId) ?? null)
        setLoaded(true)
      })
      .catch((e) => {
        reportError(e.message)
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [lessonId])

  // Проверка ответов идёт на сервере после сборки — ждём её итог
  const checking = material?.check === 'pending'
  useEffect(() => {
    if (!checking) return undefined
    let alive = true
    const timer = setInterval(() => {
      api
        .get(materialsPath(lessonId))
        .then((list) => {
          const next = list.find((m) => m.lessonId === lessonId)
          // Только итог проверки: текст репетитор мог уже открыть на правку
          if (alive && next && next.check !== 'pending') setMaterial(next)
        })
        .catch(() => {})
    }, CHECK_POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [checking, lessonId])

  const generating = busy === 'generate'
  useEffect(() => {
    if (!generating) return undefined
    setStage(0)
    const timers = STEP_AT_MS.map((ms, i) => setTimeout(() => setStage(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [generating])

  const choices = subjectChoices(subjects)
  const subjectName = subject === OTHER ? customSubject.trim() : subject
  const canGenerate = topic.trim().length >= 3 && subjectName.length >= 2 && !busy
  const level = levelLabel(student)
  // Экзамен сам задаёт страну; выбор программы нужен только без экзамена
  const noExam = !student || student.goal === 'SCHOOL'

  const generate = async () => {
    setBusy('generate')
    try {
      const next = await api.post(`/lessons/${lessonId}/material`, {
        subject: subjectName,
        topic: topic.trim(),
        homeworkCount: count,
        ...(wishes.trim() ? { wishes: wishes.trim() } : {}),
      })
      setMaterial(next)
      setEditing(false)
      setSent(false)
      // Новый предмет запоминается в профиле: в следующий раз он в списке
      if (!subjects.includes(subjectName)) onAddSubject(subjectName)
    } catch (e) {
      reportError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const save = async (content) => {
    setBusy('save')
    try {
      setMaterial(await api.patch(`/lessons/${lessonId}/material`, { content }))
      setRevising(false)
      setSent(false)
    } catch (e) {
      reportError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    setBusy('send')
    try {
      await api.post(`/lessons/${lessonId}/material/send`)
      setSent(true)
    } catch (e) {
      reportError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const download = async (answers) => {
    setBusy(answers ? 'pdf-answers' : 'pdf')
    try {
      const { token, filename } = await api.post(`/lessons/${lessonId}/material/pdf-link`, { answers })
      downloadFile(`${API_URL}/materials/pdf?token=${encodeURIComponent(token)}`, filename)
    } catch (e) {
      reportError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const startEditing = () => {
    setTopic(material?.topic ?? '')
    const prev = material?.subject
    if (!prev || choices.includes(prev)) {
      setSubject(prev ?? choices[0])
    } else {
      setSubject(OTHER)
      setCustomSubject(prev)
    }
    setCount(COUNT_OPTIONS.some((o) => o.value === material?.homework.length) ? material.homework.length : 6)
    setEditing(true)
  }

  if (!loaded) return null

  const showForm = !material || editing
  const hasAnswers = material ? material.homework.some((h) => h.answer) : false
  // Считается один раз на рендер, а не в условии и в самом тексте
  const note = material ? checkNote(material) : null

  return (
    <Section title="Материалы урока" aside={<span className={s.ai}>ИИ</span>}>
      {busy === 'generate' ? (
        <div className={s.card} role="status">
          <span className={s.genTopic}>«{topic.trim()}»</span>
          {STEPS.map((label, i) => (
            <div key={label} className={cx(s.step, i > stage && s.wait)}>
              <span className={s.mark}>
                {i < stage ? <span className={s.check}>✓</span> : i === stage ? <span className={s.spinner} /> : <span className={s.ring} />}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : showForm ? (
        <div className={s.card}>
          <Field label="Предмет">
            <Select className={s.soft} value={subject} onChange={(e) => setSubject(e.target.value)}>
              {choices.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={OTHER}>Другой…</option>
            </Select>
          </Field>
          {subject === OTHER ? (
            <Input
              className={s.soft}
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Например, Биология"
              maxLength={60}
              autoFocus
              aria-label="Название предмета"
            />
          ) : null}
          <Field label="Тема урока">
            <Textarea
              className={cx(s.soft, s.topicInput)}
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Например: теорема Виета"
              maxLength={200}
            />
          </Field>
          <Field label="Пожелания · необязательно">
            <Textarea
              className={cx(s.soft, s.wishes)}
              rows={2}
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder="Больше текстовых задач, без дробей"
              maxLength={500}
            />
          </Field>
          <FieldGroup label="Домашнее задание">
            <Segmented className={s.softGroup} label="Сколько заданий" options={COUNT_OPTIONS} value={count} onChange={setCount} />
          </FieldGroup>
          {noExam ? (
            <FieldGroup label="Школьная программа">
              <Segmented className={s.softGroup} label="Страна" options={COUNTRY_OPTIONS} value={country} onChange={onSetCountry} />
            </FieldGroup>
          ) : null}

          {student ? (
            <button type="button" className={s.level} onClick={() => onOpenStudent(student.id)}>
              {level
                ? `Для ученика: ${level}. Изменить ›`
                : 'Класс и цель ученика не указаны — материал будет общим. Указать ›'}
            </button>
          ) : null}

          <span className={s.hint}>
            ИИ напишет короткую теорию, разберёт пример и подберёт {count} {count === 4 ? 'задачи' : 'задач'} на дом.
            PDF оформится в вашем стиле, с вашим именем.
          </span>
          <Button onClick={generate} disabled={!canGenerate}>Собрать PDF</Button>
          {editing ? (
            <Button variant="secondary" onClick={() => setEditing(false)}>Отмена</Button>
          ) : null}
        </div>
      ) : revising ? (
        <MaterialEditor
          material={material}
          saving={busy === 'save'}
          onSave={save}
          onCancel={() => setRevising(false)}
        />
      ) : (
        <>
          {material.isTemplate ? (
            <Note>Это заготовка без ИИ: ключ ИИ на сервере не задан.</Note>
          ) : (
            <Note>Проверьте текст перед отправкой: ИИ может ошибаться в расчётах и ответах.</Note>
          )}
          {note ? <Note>{note}</Note> : null}
          <MaterialPreview
            material={material}
            pill={[material.subject, level].filter(Boolean).join(' · ')}
            meta={[student?.name, date].filter(Boolean).join(' · ')}
            footer={tutorName ? `${tutorName} · репетитор` : 'Репетитор'}
          />
          {sent ? <Note>PDF без ответов — в чате с ботом. Перешлите его ученику.</Note> : null}
          <MaterialActions
            busy={busy}
            sent={sent}
            hasAnswers={hasAnswers}
            onDownload={download}
            onSend={send}
            onEditText={() => setRevising(true)}
            onChangeTopic={startEditing}
            onDelete={onDelete}
          />
        </>
      )}
    </Section>
  )
}
