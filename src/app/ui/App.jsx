import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyTheme, tg } from '../../shared/api/telegram.js'
import { AppShell, EmptyState, TabBar, Toast } from '../../shared/ui/index.js'
import { indexById } from '../../entities/student/index.js'
import { StudentsPage } from '../../pages/students/index.js'
import { LessonsPage } from '../../pages/lessons/index.js'
import { StudentPage } from '../../pages/student/index.js'
import { LessonPage } from '../../pages/lesson/index.js'
import { AddStudentForm } from '../../features/add-student/index.js'
import { AddLessonForm } from '../../features/add-lesson/index.js'
import { ImportFromTelegram } from '../../features/import-from-telegram/index.js'
import { useStore } from '../model/useStore.js'
import { backTarget, LIST_VIEWS } from '../model/navigation.js'

const TABS = [
  { value: 'students', label: 'Ученики' },
  { value: 'lessons', label: 'Занятия' },
]

export default function App() {
  const store = useStore()
  const [view, setView] = useState({ name: 'students' })
  const [toast, setToast] = useState('')

  // initTelegram() вызывается в main.jsx до первого рендера — здесь
  // остаётся только тема, которая может меняться в процессе работы.
  useEffect(() => {
    applyTheme()
    tg?.onEvent?.('themeChanged', applyTheme)
    return () => tg?.offEvent?.('themeChanged', applyTheme)
  }, [])

  // Ошибки фоновых запросов (см. reportError в useStore) всплывают сюда же,
  // тем же тостом, что и обычные уведомления — заводить отдельный UI
  // под них не оправдано.
  useEffect(() => {
    const onApiError = (e) => setToast(e.detail)
    window.addEventListener('api-error', onApiError)
    return () => window.removeEventListener('api-error', onApiError)
  }, [])

  // Аппаратная кнопка «назад» в Telegram — на всех экранах кроме корневых списков
  useEffect(() => {
    const bb = tg?.BackButton
    if (!bb) return
    if (LIST_VIEWS.includes(view.name)) {
      bb.hide()
      return
    }
    const goBack = () => setView(backTarget(view))
    bb.onClick(goBack)
    bb.show()
    return () => {
      bb.offClick(goBack)
      bb.hide()
    }
  }, [view])

  const hideToast = useCallback(() => setToast(''), [])

  const studentById = useMemo(() => indexById(store.students), [store.students])

  const handleAddStudent = useCallback(
    (input) => {
      store.addStudent(input)
      setView({ name: 'students' })
    },
    [store]
  )

  const handleAddLesson = useCallback(
    (input) => {
      store.addLesson(input)
      setView({ name: 'lessons' })
    },
    [store]
  )

  const handleDeleteLesson = useCallback(
    (id) => {
      store.deleteLesson(id)
      setView({ name: 'lessons' })
    },
    [store]
  )

  const handleDeleteStudent = useCallback(
    (id) => {
      store.deleteStudent(id)
      setView({ name: 'students' })
    },
    [store]
  )

  const currentLesson =
    view.name === 'lesson' ? store.lessons.find((l) => l.id === view.id) : null

  // Вход и первая загрузка данных с сервера идут перед любым экраном:
  // без них store.students пуст не потому, что учеников нет,
  // а потому что запрос ещё не пришёл.
  if (store.authError) {
    return (
      <AppShell>
        <EmptyState title="Не удалось подключиться">
          {store.authError}
          <br />
          Откройте приложение из Telegram и попробуйте ещё раз.
        </EmptyState>
      </AppShell>
    )
  }

  if (!store.ready) {
    return (
      <AppShell>
        <EmptyState>Загрузка…</EmptyState>
      </AppShell>
    )
  }

  return (
    <AppShell>

      {view.name === 'students' ? (
        <StudentsPage
          students={store.students}
          lessons={store.lessons}
          onOpen={(id) => setView({ name: 'student', id })}
          onAdd={() => setView({ name: 'addStudent' })}
          onInvite={() => setView({ name: 'importStudents' })}
        />
      ) : null}

      {view.name === 'lessons' ? (
        <LessonsPage
          students={store.students}
          lessons={store.lessons}
          onOpen={(id) => setView({ name: 'lesson', id, from: 'lessons' })}
          onAdd={() => setView({ name: 'addLesson' })}
        />
      ) : null}

      {view.name === 'student' ? (
        <StudentPage
          student={studentById.get(view.id)}
          lessons={store.lessons}
          onBack={() => setView({ name: 'students' })}
          onOpenLesson={(id) => setView({ name: 'lesson', id, from: 'student', studentId: view.id })}
          onAddLesson={(studentId) => setView({ name: 'addLesson', studentId })}
          onDelete={handleDeleteStudent}
          onNotify={setToast}
          onInvite={store.inviteStudent}
          inviteLink={store.inviteLinks.get(view.id)}
          onUpdateNotify={store.updateNotify}
        />
      ) : null}

      {view.name === 'lesson' ? (
        <LessonPage
          lesson={currentLesson}
          student={currentLesson ? studentById.get(currentLesson.studentId) : null}
          onBack={() => setView(backTarget(view))}
          onSetStatus={store.setStatus}
          onTogglePaid={store.togglePaid}
          onDelete={handleDeleteLesson}
        />
      ) : null}

      {view.name === 'addStudent' ? (
        <AddStudentForm onSave={handleAddStudent} onCancel={() => setView({ name: 'students' })} />
      ) : null}

      {view.name === 'importStudents' ? (
        <ImportFromTelegram
          onCreate={store.createAndInvite}
          onCancel={() => setView({ name: 'students' })}
          onDone={(message) => {
            setView({ name: 'students' })
            setToast(message)
          }}
        />
      ) : null}

      {view.name === 'addLesson' ? (
        <AddLessonForm
          students={store.students}
          presetStudentId={view.studentId}
          onSave={handleAddLesson}
          onCancel={() => setView(backTarget(view))}
        />
      ) : null}

      {/* Нижнее меню — только на корневых списках. На остальных экранах
          внизу системная MainButton Telegram, и они бы наложились. */}
      {LIST_VIEWS.includes(view.name) ? (
        <TabBar items={TABS} value={view.name} onChange={(name) => setView({ name })} />
      ) : null}

      <Toast message={toast} onHide={hideToast} />
    </AppShell>
  )
}
