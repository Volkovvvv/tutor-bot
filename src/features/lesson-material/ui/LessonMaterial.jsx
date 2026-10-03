import { useEffect, useState } from 'react'
import { levelLabel } from '../../../entities/student/index.js'
import { api, API_URL } from '../../../shared/api/client.js'
import { downloadFile } from '../../../shared/api/telegram.js'
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
  Stack,
} from '../../../shared/ui/index.js'
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

const COUNTRY_OPTIONS = [
  { value: 'RU', label: 'Россия' },
  { value: 'BY', label: 'Беларусь' },
]

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
}) {
  const [material, setMaterial] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(subjects[0] ?? SUBJECTS[0])
  // Предмет, которого нет в списке: вводится вручную
  const [customSubject, setCustomSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(6)
  // Правка текста готового материала (не путать с editing — сменой темы)
  const [revising, setRevising] = useState(false)
  // 'generate' | 'save' | 'send' | 'pdf' | 'pdf-answers' | null — что сейчас выполняется
  const [busy, setBusy] = useState(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    setSent(false)
    setRevising(false)
    api
      .get('/materials')
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

  return (
    <Section title="Материалы к уроку">
      {showForm ? (
        <Stack>
          <Field label="Предмет">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {choices.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={OTHER}>Другой…</option>
            </Select>
          </Field>
          {subject === OTHER ? (
            <Input
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Например, Биология"
              maxLength={60}
              autoFocus
              aria-label="Название предмета"
            />
          ) : null}
          <Field label="Тема урока">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Например, теорема Виета"
              maxLength={200}
            />
          </Field>
          <FieldGroup label="Домашнее задание">
            <Segmented label="Сколько заданий" options={COUNT_OPTIONS} value={count} onChange={setCount} />
          </FieldGroup>
          {noExam ? (
            <FieldGroup label="Школьная программа">
              <Segmented label="Страна" options={COUNTRY_OPTIONS} value={country} onChange={onSetCountry} />
            </FieldGroup>
          ) : null}

          {student ? (
            <button type="button" className={s.level} onClick={() => onOpenStudent(student.id)}>
              {level
                ? `Для ученика: ${level}. Изменить ›`
                : 'Класс и цель ученика не указаны — материал будет общим. Указать ›'}
            </button>
          ) : null}

          <Button onClick={generate} disabled={!canGenerate}>
            {busy === 'generate' ? 'ИИ пишет… до минуты' : 'Собрать конспект и домашку'}
          </Button>
          {editing ? (
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy === 'generate'}>
              Отмена
            </Button>
          ) : null}
        </Stack>
      ) : revising ? (
        <MaterialEditor
          material={material}
          saving={busy === 'save'}
          onSave={save}
          onCancel={() => setRevising(false)}
        />
      ) : (
        <Stack>
          {material.isTemplate ? (
            <Note>Это заготовка без ИИ: ключ ИИ на сервере не задан.</Note>
          ) : (
            <Note>Проверьте текст перед отправкой: ИИ может ошибаться в расчётах и ответах.</Note>
          )}
          <MaterialPreview material={material} />

          <Button onClick={() => download(false)} disabled={!!busy}>
            {busy === 'pdf' ? 'Готовлю файл…' : 'Скачать PDF для ученика'}
          </Button>
          {hasAnswers ? (
            <Button variant="secondary" onClick={() => download(true)} disabled={!!busy}>
              {busy === 'pdf-answers' ? 'Готовлю файл…' : 'Скачать PDF с ответами'}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={send} disabled={!!busy}>
            {busy === 'send' ? 'Отправляю…' : sent ? 'Отправлено — отправить ещё раз' : 'Прислать PDF в Telegram'}
          </Button>
          {sent ? <Note>PDF без ответов — в чате с ботом. Перешлите его ученику.</Note> : null}
          <Button variant="secondary" onClick={() => setRevising(true)} disabled={!!busy}>
            Редактировать текст
          </Button>
          <Button variant="secondary" onClick={startEditing} disabled={!!busy}>
            Изменить тему
          </Button>
        </Stack>
      )}
    </Section>
  )
}
