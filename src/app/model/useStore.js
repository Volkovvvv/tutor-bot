import { useCallback, useEffect, useState } from 'react'
import { api, login } from '../../shared/api/client.js'
import { haptic } from '../../shared/api/telegram.js'
import {
  lessonFromApi,
  lessonToApi,
  notifyToApi,
  statusToApi,
  studentFromApi,
  studentToApi,
} from '../../shared/api/mappers.js'

/**
 * Загружает и хранит данные с бэкенда.
 *
 * Раньше это был localStorage — каждое действие писало в него синхронно
 * и React сразу перерисовывал экран. Компоненты (формы, кнопки) продолжают
 * вызывать методы синхронно и без await, поэтому обновления делаются
 * оптимистично: состояние меняется сразу, а запрос уходит на сервер в фоне.
 * Если запрос не удался — правим локальное состояние обратно и показываем
 * ошибку через глобальное событие (window.dispatchEvent), чтобы не тащить
 * систему тостов в этот файл.
 */
function reportError(message) {
  window.dispatchEvent(new CustomEvent('api-error', { detail: message }))
}

export function useStore() {
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState(null)
  // Ссылка приглашения по id ученика — сервер не хранит её на карточке,
  // только на выданном Invite. Живёт до перезагрузки страницы.
  const [inviteLinks, setInviteLinks] = useState(new Map())

  // Вход и первичная загрузка. initData валиден весь сеанс работы
  // мини-аппа, поэтому один раз при монтировании.
  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        await login()
        const [studentsRes, lessonsRes] = await Promise.all([
          api.get('/students'),
          api.get('/lessons'),
        ])
        if (cancelled) return
        setStudents(studentsRes.map(studentFromApi))
        setLessons(lessonsRes.map(lessonFromApi))
        setReady(true)
      } catch (e) {
        if (cancelled) return
        setAuthError(e.message ?? 'Не удалось подключиться к серверу')
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [])

  // Статус приглашения меняет бот сам, когда ученик жмёт /start — с сервера,
  // а не по действию в этом приложении. Опрашиваем раз в 15 секунд, пока
  // экран открыт, чтобы «Приглашение отправлено» само сменилось на «Подключён».
  useEffect(() => {
    if (!ready) return
    const id = setInterval(() => {
      api
        .get('/students')
        .then((res) => setStudents(res.map(studentFromApi)))
        .catch(() => {
          // Сеть моргнула — молча пробуем на следующем тике,
          // не заваливаем пользователя ошибками фонового опроса.
        })
    }, 15_000)
    return () => clearInterval(id)
  }, [ready])

  const addStudent = useCallback((input) => {
    api
      .post('/students', studentToApi(input))
      .then((created) => setStudents((list) => [...list, studentFromApi(created)]))
      .catch((e) => reportError(e.message))
    haptic()
  }, [])

  // «Пригласить ученика»: создать карточку и сразу приглашение одним
  // действием. Telegram не даёт мини-аппу список чатов пользователя
  // (ограничение приватности платформы — нет такого метода ни в WebApp
  // SDK, ни в Bot API), поэтому выбор чата идёт через нативный пикер
  // switchInlineQuery уже с готовым текстом, а не через список контактов
  // в самом приложении.
  //
  // Возвращает { message } — компонент передаёт его в shareText(),
  // который и открывает системный пикер.
  const createAndInvite = useCallback((input) => {
    haptic()
    return api
      .post('/students', studentToApi(input))
      .then((created) => {
        const student = studentFromApi(created)
        setStudents((list) => [...list, student])
        return api.post(`/students/${student.id}/invite`).then(({ message, link }) => {
          setStudents((list) =>
            list.map((s) => (s.id === student.id ? { ...s, inviteStatus: 'invited' } : s))
          )
          setInviteLinks((m) => new Map(m).set(student.id, link))
          return { message }
        })
      })
      .catch((e) => {
        reportError(e.message)
        return null
      })
  }, [])

  const addLesson = useCallback((input) => {
    api
      .post('/lessons', lessonToApi(input))
      .then((created) => setLessons((list) => [...list, lessonFromApi(created)]))
      .catch((e) => reportError(e.message))
    haptic()
  }, [])

  const setStatus = useCallback((id, status) => {
    const prev = lessons
    setLessons((list) => list.map((l) => (l.id === id ? { ...l, status } : l)))
    api
      .patch(`/lessons/${id}`, { status: statusToApi(status) })
      .catch((e) => {
        setLessons(prev)
        reportError(e.message)
      })
    haptic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons])

  const togglePaid = useCallback((id) => {
    const prev = lessons
    const current = lessons.find((l) => l.id === id)
    if (!current) return
    const nextPaid = !current.paid
    setLessons((list) => list.map((l) => (l.id === id ? { ...l, paid: nextPaid } : l)))
    api
      .patch(`/lessons/${id}`, { paid: nextPaid })
      .catch((e) => {
        setLessons(prev)
        reportError(e.message)
      })
    haptic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons])

  const deleteLesson = useCallback((id) => {
    const prev = lessons
    setLessons((list) => list.filter((l) => l.id !== id))
    api.delete(`/lessons/${id}`).catch((e) => {
      setLessons(prev)
      reportError(e.message)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons])

  // Удаление ученика на сервере отказывает, если у него есть занятия
  // (см. StudentsService.remove) — тогда просим архивировать вместо удаления.
  const deleteStudent = useCallback((id) => {
    const prevStudents = students
    const prevLessons = lessons
    setStudents((list) => list.filter((s) => s.id !== id))
    setLessons((list) => list.filter((l) => l.studentId !== id))
    api.delete(`/students/${id}`).catch((e) => {
      setStudents(prevStudents)
      setLessons(prevLessons)
      reportError(
        e.status === 409
          ? 'У ученика есть занятия — удаление недоступно. Обратитесь к разработчику для архивации.'
          : e.message
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, lessons])

  // Приглашение создаёт сервер: он же генерирует безопасный код и ссылку
  // (16 символов, случайных криптографически — см. api/README.md).
  // Возвращает промис с { message, link } — InviteStudent.jsx дожидается
  // его перед тем, как звать shareText/copyText.
  const inviteStudent = useCallback((id) => {
    haptic()
    return api
      .post(`/students/${id}/invite`)
      .then(({ message, link }) => {
        setStudents((list) =>
          list.map((s) => (s.id === id ? { ...s, inviteStatus: 'invited' } : s))
        )
        setInviteLinks((m) => new Map(m).set(id, link))
        return { message, link }
      })
      .catch((e) => {
        reportError(e.message)
        return null
      })
  }, [])

  const updateNotify = useCallback((id, notify) => {
    const prev = students
    setStudents((list) => list.map((s) => (s.id === id ? { ...s, notify } : s)))
    api
      .patch(`/students/${id}/notify`, notifyToApi(notify))
      .catch((e) => {
        setStudents(prev)
        reportError(e.message)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students])

  return {
    ready,
    authError,
    students,
    lessons,
    inviteLinks,
    addStudent,
    createAndInvite,
    inviteStudent,
    updateNotify,
    addLesson,
    setStatus,
    togglePaid,
    deleteLesson,
    deleteStudent,
  }
}
