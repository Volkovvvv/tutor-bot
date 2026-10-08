// Граница форматов между бэкендом и текущим UI.
//
// UI написан под старую схему (рубли, date+time, paid: boolean) и его
// правильнее не трогать — компонентов, завязанных на эти поля, около
// десятка. Вместо этого конвертация происходит один раз здесь,
// на входе и выходе из useStore.

const INVITE_STATUS_FROM_API = {
  NONE: 'none',
  INVITED: 'invited',
  ACCEPTED: 'accepted',
}

const SOURCE_FROM_API = {
  MANUAL: 'manual',
  TELEGRAM: 'telegram',
}

const STATUS_FROM_API = {
  PLANNED: 'planned',
  DONE: 'done',
  CANCELLED: 'cancelled',
}

const STATUS_TO_API = {
  planned: 'PLANNED',
  done: 'DONE',
  cancelled: 'CANCELLED',
}

export function studentFromApi(s) {
  return {
    id: s.id,
    name: s.name,
    // Свободная пометка репетитора: «любит задачи»
    note: s.note ?? null,
    // Класс (1–11 или null) — для материалов урока
    grade: s.grade ?? null,
    // API отдаёт копейки — UI всегда работал в рублях.
    price: Math.round(s.price / 100),
    tgId: null,
    username: null,
    source: SOURCE_FROM_API[s.source] ?? 'manual',
    inviteStatus: INVITE_STATUS_FROM_API[s.inviteStatus] ?? 'none',
    // Код приглашения сервер не хранит на карточке — только на активном
    // Invite. Актуальный код/ссылку получаем отдельным вызовом при приглашении.
    inviteCode: null,
    notify: s.notify
      ? {
          enabled: s.notify.enabled,
          beforeHours: s.notify.beforeHours,
          beforeMinutes: s.notify.beforeMinutes,
          debtReminder: s.notify.debtReminder,
          quietFrom: s.notify.quietFrom,
          quietTo: s.notify.quietTo,
        }
      : null,
  }
}

export function studentToApi({ name, price, grade }) {
  // UI собирает цену в рублях как введённую пользователем строку/число.
  return {
    name,
    price: Math.round(Number(price) * 100),
    ...(grade ? { grade } : {}),
  }
}

export function notifyToApi(notify) {
  return {
    enabled: notify.enabled,
    beforeHours: notify.beforeHours,
    beforeMinutes: notify.beforeMinutes,
    debtReminder: notify.debtReminder,
    quietFrom: notify.quietFrom,
    quietTo: notify.quietTo,
  }
}

function splitIso(iso) {
  // "2026-10-01T16:00:00.000+03:00" → { date: "2026-10-01", time: "16:00" }
  // в локальной таймзоне браузера — так же, как раньше показывал UI.
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { date, time }
}

export function lessonFromApi(l) {
  const { date, time } = splitIso(l.startsAt)
  return {
    id: l.id,
    studentId: l.studentId,
    date,
    time,
    duration: l.duration ?? 60,
    // Снимок цены на момент создания: подъём цены ученику не переписывает прошлое
    price: Math.round(l.price / 100),
    status: STATUS_FROM_API[l.status] ?? 'planned',
    paid: l.paidAt !== null,
    // Серия «каждую неделю», из которой занятие создано; null — разовое
    seriesId: l.seriesId ?? null,
  }
}

export function lessonToApi({ studentId, date, time, duration }) {
  // input[type=date] и input[type=time] отдают локальное время без зоны;
  // new Date с составной строкой трактует её как локальную, что и нужно —
  // репетитор ставит занятие в своём времени.
  const local = new Date(`${date}T${time}:00`)
  return { studentId, startsAt: local.toISOString(), ...(duration ? { duration } : {}) }
}

// Правка занятия: время — как в lessonToApi, цена — в копейки
export function lessonPatchToApi({ date, time, duration, price }) {
  return {
    startsAt: new Date(`${date}T${time}:00`).toISOString(),
    duration,
    price: Math.round(Number(price) * 100),
  }
}

export function statusToApi(status) {
  return STATUS_TO_API[status] ?? 'PLANNED'
}

// Профиль репетитора: цена по умолчанию тоже в копейках на сервере
export function tutorFromApi(t) {
  return {
    displayName: t.displayName,
    telegramName: t.telegramName,
    subjects: t.subjects,
    defaultPrice: t.defaultPrice === null ? null : Math.round(t.defaultPrice / 100),
    country: t.country ?? 'RU',
    notifyBeforeHours: t.notifyBeforeHours,
    notifyBeforeMinutes: t.notifyBeforeMinutes,
    notifyDebtReminder: t.notifyDebtReminder,
    onboardedAt: t.onboardedAt,
  }
}

export function tutorToApi(patch) {
  const { defaultPrice, ...rest } = patch
  return defaultPrice === undefined
    ? rest
    : { ...rest, defaultPrice: defaultPrice === null ? null : Math.round(Number(defaultPrice) * 100) }
}
