import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getAll, login } from '../../shared/api/client.js'
import { haptic } from '../../shared/api/telegram.js'
import {
  lessonFromApi,
  lessonPatchToApi,
  lessonToApi,
  notifyToApi,
  statusToApi,
  studentFromApi,
  studentToApi,
  tutorFromApi,
  tutorToApi,
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

const POLL_MS = 15_000

// Откат трогает только ту запись, что меняли: слепок всего списка затёр бы
// правки, которые прошли, пока этот запрос был в пути.
const patchItem = (id, patch) => (list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x))

// Вернуть запись, удалённую оптимистично, на прежнее место
function putBack(items) {
  return (list) => {
    const missing = items.filter(({ item }) => !list.some((x) => x.id === item.id))
    if (missing.length === 0) return list
    const next = [...list]
    for (const { item, index } of missing) next.splice(Math.min(index, next.length), 0, item)
    return next
  }
}

// Только поля patch из записи before: чтобы откатить правку, а не всю запись
function fieldsOf(before, patch) {
  return Object.fromEntries(Object.keys(patch).map((key) => [key, before[key]]))
}

export function useStore() {
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  // Профиль репетитора: имя для учеников, предметы, умолчания, онбординг
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState(null)
  // Ссылка приглашения по id ученика — сервер не хранит её на карточке,
  // только на выданном Invite. Живёт до перезагрузки страницы.
  const [inviteLinks, setInviteLinks] = useState(() => new Map())

  // Актуальные списки для обработчиков: им нужно знать, что было до правки,
  // а зависеть от списков значило бы пересоздавать каждый обработчик при любом изменении
  const studentsRef = useRef(students)
  const lessonsRef = useRef(lessons)
  studentsRef.current = students
  lessonsRef.current = lessons

  // Вход и первичная загрузка. initData валиден весь сеанс работы
  // мини-аппа, поэтому один раз при монтировании.
  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        await login()
        const [studentsRes, lessonsRes, tutorRes] = await Promise.all([
          getAll('/students'),
          getAll('/lessons'),
          api.get('/tutor'),
        ])
        if (cancelled) return
        setProfile(tutorFromApi(tutorRes))
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
  // экран виден, чтобы «Приглашение отправлено» само сменилось на «Подключён».
  // Свёрнутому приложению опрос не нужен; при возврате обновляемся сразу.
  useEffect(() => {
    if (!ready) return undefined

    const refresh = () => {
      if (document.hidden) return
      getAll('/students')
        .then((res) => {
          const next = res.map(studentFromApi)
          // Ничего не изменилось — не перерисовываем приложение впустую
          setStudents((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
        })
        .catch(() => {
          // Сеть моргнула — молча пробуем на следующем тике,
          // не заваливаем пользователя ошибками фонового опроса.
        })
    }

    const id = setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
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

  // Занятие «каждую неделю»: сервер создаёт серию и сразу занятия на 12 недель
  // вперёд, дальше продлевает сам (см. api/src/lessons/lesson-series.service.ts).
  const addSeries = useCallback((input) => {
    api
      .post('/lessons/series', { series: [lessonToApi(input)] })
      .then((res) => {
        setLessons((list) => [...list, ...res.created.map(lessonFromApi)])
        if (res.created.length === 0) reportError('Такое занятие каждую неделю уже есть')
      })
      .catch((e) => reportError(e.message))
    haptic()
  }, [])

  // «Удалить это и все следующие»: серия обрывается на этом занятии.
  // Проведённые и отменённые остаются — это уже история.
  // Возвращает id удалённых занятий: экран, открытый на одном из них, нужно закрыть.
  const stopSeries = useCallback((lesson) => {
    const from = `${lesson.date} ${lesson.time}`
    const removed = lessonsRef.current.flatMap((item, index) =>
      item.seriesId === lesson.seriesId && item.status === 'planned' && `${item.date} ${item.time}` >= from
        ? [{ item, index }]
        : []
    )
    const gone = new Set(removed.map(({ item }) => item.id))
    setLessons((list) => list.filter((l) => !gone.has(l.id)))
    const { startsAt } = lessonToApi(lesson)
    api.delete(`/lessons/series/${lesson.seriesId}?from=${encodeURIComponent(startsAt)}`).catch((e) => {
      setLessons(putBack(removed))
      reportError(e.message)
    })
    haptic()
    return [...gone]
  }, [])

  // Импорт расписания: сначала карточки новых учеников, потом все занятия
  // одним запросом. Не оптимистично — экран импорта ждёт результата.
  //
  // newStudents: [{ key, name, price }], lessons: [{ studentId | studentKey, date, time, duration? }].
  // repeat — занятия повторяются каждую неделю: lessons тогда — первые занятия серий.
  // known — id учеников, созданных прошлой попыткой: если занятия тогда
  // не сохранились, повтор не должен завести тех же учеников второй раз.
  // Возвращает { ok, studentIds, created, skipped }.
  const importSchedule = useCallback(async ({ newStudents, lessons: planned, repeat = false, known = {} }) => {
    haptic()
    const studentIds = { ...known }
    try {
      for (const st of newStudents) {
        if (studentIds[st.key]) continue
        const created = studentFromApi(await api.post('/students', studentToApi(st)))
        studentIds[st.key] = created.id
        setStudents((list) => [...list, created])
      }
      const items = planned.map((l) => lessonToApi({ ...l, studentId: l.studentId ?? studentIds[l.studentKey] }))
      const res = repeat
        ? await api.post('/lessons/series', { series: items })
        : await api.post('/lessons/bulk', { lessons: items })
      setLessons((list) => [...list, ...res.created.map(lessonFromApi)])
      return { ok: true, studentIds, created: res.created.length, skipped: res.skipped }
    } catch (e) {
      reportError(e.message)
      return { ok: false, studentIds, created: 0, skipped: 0 }
    }
  }, [])

  // Перенос занятия, длительность и цена: { date, time, duration, price }
  const updateLesson = useCallback((id, patch) => {
    const before = lessonsRef.current.find((l) => l.id === id)
    setLessons(patchItem(id, patch))
    api.patch(`/lessons/${id}`, lessonPatchToApi(patch)).catch((e) => {
      if (before) setLessons(patchItem(id, fieldsOf(before, patch)))
      reportError(e.message)
    })
    haptic()
  }, [])

  const setStatus = useCallback((id, status) => {
    const before = lessonsRef.current.find((l) => l.id === id)
    setLessons(patchItem(id, { status }))
    api.patch(`/lessons/${id}`, { status: statusToApi(status) }).catch((e) => {
      if (before) setLessons(patchItem(id, { status: before.status }))
      reportError(e.message)
    })
    haptic()
  }, [])

  const togglePaid = useCallback((id) => {
    const before = lessonsRef.current.find((l) => l.id === id)
    if (!before) return
    const paid = !before.paid
    setLessons(patchItem(id, { paid }))
    api.patch(`/lessons/${id}`, { paid }).catch((e) => {
      setLessons(patchItem(id, { paid: before.paid }))
      reportError(e.message)
    })
    haptic()
  }, [])

  const deleteLesson = useCallback((id) => {
    const index = lessonsRef.current.findIndex((l) => l.id === id)
    const removed = index === -1 ? null : { item: lessonsRef.current[index], index }
    setLessons((list) => list.filter((l) => l.id !== id))
    api.delete(`/lessons/${id}`).catch((e) => {
      if (removed) setLessons(putBack([removed]))
      reportError(e.message)
    })
  }, [])

  // Ученик удаляется вместе со всеми занятиями и материалами (каскад на сервере).
  // Возвращает id удалённых вместе с ним занятий: экран, открытый на одном
  // из них, нужно закрыть.
  const deleteStudent = useCallback((id) => {
    const at = (list, match) =>
      list.flatMap((item, index) => (match(item) ? [{ item, index }] : []))
    const removedStudent = at(studentsRef.current, (s) => s.id === id)
    const removedLessons = at(lessonsRef.current, (l) => l.studentId === id)
    setStudents((list) => list.filter((s) => s.id !== id))
    setLessons((list) => list.filter((l) => l.studentId !== id))
    api.delete(`/students/${id}`).catch((e) => {
      setStudents(putBack(removedStudent))
      setLessons(putBack(removedLessons))
      reportError(e.message)
    })
    return removedLessons.map(({ item }) => item.id)
  }, [])

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

  // Не оптимистично: онбординг должен дождаться сохранения, прежде чем
  // идти дальше. Возвращает обновлённый профиль или null при ошибке.
  const updateProfile = useCallback((patch) => {
    return api
      .patch('/tutor', tutorToApi(patch))
      .then((res) => {
        const next = tutorFromApi(res)
        setProfile(next)
        return next
      })
      .catch((e) => {
        reportError(e.message)
        return null
      })
  }, [])

  // Правка карточки: имя, цена, класс. Цена на сервере — в копейках.
  const updateStudent = useCallback((id, patch) => {
    const before = studentsRef.current.find((s) => s.id === id)
    setStudents(patchItem(id, patch))
    const body = patch.price === undefined ? patch : { ...patch, price: Math.round(Number(patch.price) * 100) }
    api.patch(`/students/${id}`, body).catch((e) => {
      if (before) setStudents(patchItem(id, fieldsOf(before, patch)))
      reportError(e.message)
    })
  }, [])

  const updateNotify = useCallback((id, notify) => {
    const before = studentsRef.current.find((s) => s.id === id)
    setStudents(patchItem(id, { notify }))
    api.patch(`/students/${id}/notify`, notifyToApi(notify)).catch((e) => {
      if (before) setStudents(patchItem(id, { notify: before.notify }))
      reportError(e.message)
    })
  }, [])

  return {
    ready,
    authError,
    students,
    lessons,
    profile,
    updateProfile,
    inviteLinks,
    addStudent,
    createAndInvite,
    inviteStudent,
    updateStudent,
    updateNotify,
    addLesson,
    updateLesson,
    addSeries,
    stopSeries,
    importSchedule,
    setStatus,
    togglePaid,
    deleteLesson,
    deleteStudent,
  }
}
