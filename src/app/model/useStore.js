import { useCallback, useEffect, useState } from 'react'
import { loadData, saveData, setStudentUpgrader } from '../../shared/api/storage.js'
import { haptic } from '../../shared/api/telegram.js'
import { createStudent, INVITE_STATUS, upgradeStudent } from '../../entities/student/index.js'
import { createLesson } from '../../entities/lesson/index.js'
import { generateInviteCode } from '../../features/invite-student/index.js'

// shared не знает про сущности, поэтому правило апгрейда передаём снаружи
setStudentUpgrader(upgradeStudent)

export function useStore() {
  const [data, setData] = useState(loadData)

  useEffect(() => {
    saveData(data)
  }, [data])

  const addStudent = useCallback((input) => {
    setData((d) => ({ ...d, students: [...d.students, createStudent(input)] }))
    haptic()
  }, [])

  // Импорт нескольких учеников разом — одним обновлением состояния
  const importStudents = useCallback((list) => {
    setData((d) => ({ ...d, students: [...d.students, ...list.map(createStudent)] }))
    haptic()
  }, [])

  const addLesson = useCallback((input) => {
    setData((d) => ({ ...d, lessons: [...d.lessons, createLesson(input)] }))
    haptic()
  }, [])

  const setStatus = useCallback((id, status) => {
    setData((d) => ({
      ...d,
      lessons: d.lessons.map((l) => (l.id === id ? { ...l, status } : l)),
    }))
    haptic()
  }, [])

  const togglePaid = useCallback((id) => {
    setData((d) => ({
      ...d,
      lessons: d.lessons.map((l) => (l.id === id ? { ...l, paid: !l.paid } : l)),
    }))
    haptic()
  }, [])

  const deleteLesson = useCallback((id) => {
    setData((d) => ({ ...d, lessons: d.lessons.filter((l) => l.id !== id) }))
  }, [])

  // Удаление ученика уносит и его занятия — иначе в списке останутся «висячие» строки
  const deleteStudent = useCallback((id) => {
    setData((d) => ({
      students: d.students.filter((s) => s.id !== id),
      lessons: d.lessons.filter((l) => l.studentId !== id),
    }))
  }, [])

  // Создаёт код приглашения и сразу возвращает его, чтобы вызывающий
  // код мог подставить ссылку в сообщение, не дожидаясь ре-рендера.
  const inviteStudent = useCallback((id) => {
    const code = generateInviteCode()
    setData((d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === id
          ? { ...s, inviteCode: s.inviteCode ?? code, inviteStatus: INVITE_STATUS.invited }
          : s
      ),
    }))
    haptic()
    return code
  }, [])

  // Пока нет бэкенда, подтверждение отмечается вручную.
  // С ботом статус будет приходить с сервера после /start.
  const markAccepted = useCallback((id) => {
    setData((d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === id ? { ...s, inviteStatus: INVITE_STATUS.accepted } : s
      ),
    }))
    haptic()
  }, [])

  const updateNotify = useCallback((id, notify) => {
    setData((d) => ({
      ...d,
      students: d.students.map((s) => (s.id === id ? { ...s, notify } : s)),
    }))
  }, [])

  return {
    students: data.students,
    lessons: data.lessons,
    addStudent,
    importStudents,
    inviteStudent,
    markAccepted,
    updateNotify,
    addLesson,
    setStatus,
    togglePaid,
    deleteLesson,
    deleteStudent,
  }
}
