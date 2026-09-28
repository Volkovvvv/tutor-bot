import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyTheme, tg } from '../../shared/api/telegram.js'
import { todayISO } from '../../shared/lib/date.js'
import { AppShell, EmptyState, TabBar, Toast } from '../../shared/ui/index.js'
import { indexById } from '../../entities/student/index.js'
import { TodayPage } from '../../pages/today/index.js'
import { CalendarPage } from '../../pages/calendar/index.js'
import { StudentsPage } from '../../pages/students/index.js'
import { MoneyPage } from '../../pages/money/index.js'
import { StudentPage } from '../../pages/student/index.js'
import { LessonPage } from '../../pages/lesson/index.js'
import { AddStudentForm } from '../../features/add-student/index.js'
import { AddLessonSheet } from '../../features/add-lesson/index.js'
import { ImportFromTelegram } from '../../features/import-from-telegram/index.js'
import { useStore } from '../model/useStore.js'
import { backLabel, backPast, backTarget, LIST_VIEWS, openView, TABS } from '../model/navigation.js'

export default function App() {
  const store = useStore()
  const [view, setView] = useState({ name: 'today' })
  const [toast, setToast] = useState('')
  // Выбранный день календаря живёт здесь: переживает уход на другую вкладку
  // и подставляется в шторку «Новое занятие»
  const [calendarDate, setCalendarDate] = useState(todayISO)
  // Шторка «Новое занятие»: { date, studentId? } или null
  const [sheet, setSheet] = useState(null)

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

  // Новый экран открывается с начала, а не с позиции прокрутки прошлого
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  // Аппаратная кнопка «назад» в Telegram — на всех экранах кроме вкладок
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

  const open = useCallback((next) => setView((current) => openView(current, next)), [])
  const openLesson = useCallback((id) => open({ name: 'lesson', id }), [open])
  const openStudent = useCallback((id) => open({ name: 'student', id }), [open])
  const goBack = useCallback(() => setView((current) => backTarget(current)), [])

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
      setSheet(null)
      setCalendarDate(input.date)
      const student = studentById.get(input.studentId)
      setToast(
        student?.inviteStatus === 'accepted'
          ? `Занятие добавлено. Бот напомнит ${student.name.split(' ')[0]} заранее`
          : 'Занятие добавлено'
      )
    },
    [store, studentById]
  )

  const handleDeleteLesson = useCallback(
    (id) => {
      store.deleteLesson(id)
      setView((current) => backPast(current, (v) => v.name === 'lesson' && v.id === id))
    },
    [store]
  )

  const handleDeleteStudent = useCallback(
    (id) => {
      const gone = new Set(store.lessons.filter((l) => l.studentId === id).map((l) => l.id))
      store.deleteStudent(id)
      setView((current) =>
        backPast(
          current,
          (v) => (v.name === 'student' && v.id === id) || (v.name === 'lesson' && gone.has(v.id))
        )
      )
    },
    [store]
  )

  const handleSetStatus = useCallback(
    (id, status) => {
      store.setStatus(id, status)
      if (status === 'cancelled') setToast('Занятие отменено')
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

      {view.name === 'today' ? (
        <TodayPage
          students={store.students}
          lessons={store.lessons}
          onOpenLesson={openLesson}
          onAddLesson={() => setSheet({ date: todayISO() })}
        />
      ) : null}

      {view.name === 'calendar' ? (
        <CalendarPage
          students={store.students}
          lessons={store.lessons}
          date={calendarDate}
          onSelectDate={setCalendarDate}
          onOpenLesson={openLesson}
          onAdd={() => setSheet({ date: calendarDate })}
        />
      ) : null}

      {view.name === 'students' ? (
        <StudentsPage
          students={store.students}
          lessons={store.lessons}
          onOpen={openStudent}
          onAdd={() => open({ name: 'addStudent' })}
          onInvite={() => open({ name: 'importStudents' })}
        />
      ) : null}

      {view.name === 'money' ? (
        <MoneyPage
          students={store.students}
          lessons={store.lessons}
          onOpenStudent={openStudent}
        />
      ) : null}

      {view.name === 'student' ? (
        <StudentPage
          student={studentById.get(view.id)}
          lessons={store.lessons}
          backLabel={backLabel(view)}
          onBack={goBack}
          onOpenLesson={openLesson}
          onAddLesson={(studentId) => setSheet({ date: calendarDate, studentId })}
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
          backLabel={backLabel(view)}
          onBack={goBack}
          onOpenStudent={openStudent}
          onSetStatus={handleSetStatus}
          onTogglePaid={store.togglePaid}
          onDelete={handleDeleteLesson}
        />
      ) : null}

      {view.name === 'addStudent' ? (
        <AddStudentForm onSave={handleAddStudent} onCancel={goBack} />
      ) : null}

      {view.name === 'importStudents' ? (
        <ImportFromTelegram
          onCreate={store.createAndInvite}
          onCancel={goBack}
          onDone={(message) => {
            setView({ name: 'students' })
            setToast(message)
          }}
        />
      ) : null}

      {/* Нижнее меню — только на вкладках. На остальных экранах
          внизу системная MainButton Telegram, и они бы наложились. */}
      {LIST_VIEWS.includes(view.name) ? (
        <TabBar items={TABS} value={view.name} onChange={(name) => setView({ name })} />
      ) : null}

      {sheet ? (
        <AddLessonSheet
          key={`${sheet.date}:${sheet.studentId ?? ''}`}
          students={store.students}
          lessons={store.lessons}
          date={sheet.date}
          studentId={sheet.studentId}
          onSave={handleAddLesson}
          onClose={() => setSheet(null)}
        />
      ) : null}

      <Toast message={toast} onHide={hideToast} />
    </AppShell>
  )
}
