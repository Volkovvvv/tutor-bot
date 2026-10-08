import { newId } from '../../../shared/lib/id.js'

// Статус приглашения:
//   'none'     — ученика не приглашали (заведён вручную)
//   'invited'  — ссылка создана и отправлена, ученик ещё не подтвердил
//   'accepted' — ученик нажал /start у бота, боту разрешено ему писать
export const INVITE_STATUS = {
  none: 'none',
  invited: 'invited',
  accepted: 'accepted',
}

export const INVITE_LABELS = {
  none: 'Не приглашён',
  invited: 'Приглашение отправлено',
  accepted: 'Подключён',
}

// Короткая метка для списка учеников: [текст, тон бейджа]
export const BOT_BADGES = {
  none: ['Не в боте', 'negative'],
  invited: ['Приглашён', 'neutral'],
  accepted: ['В боте', 'positive'],
}

export const GRADES = Array.from({ length: 11 }, (_, i) => i + 1)

// «10 класс» или null
export function levelLabel(student) {
  if (!student) return null
  return student.grade ? `${student.grade} класс` : null
}

// Настройки уведомлений конкретного ученика.
// Их применяет бот на втором этапе; приложение только хранит и показывает.
export function defaultNotifySettings() {
  return {
    enabled: true,
    // за сколько часов до занятия напомнить
    beforeHours: 24,
    // напоминание в день занятия за N минут (0 — выключено)
    beforeMinutes: 60,
    // напоминание о неоплаченных прошедших занятиях
    debtReminder: true,
    // не писать раньше / позже указанного времени
    quietFrom: '22:00',
    quietTo: '09:00',
  }
}

export function createStudent({
  name,
  price,
  tgId = null,
  username = null,
  source = 'manual',
  inviteStatus = INVITE_STATUS.none,
  inviteCode = null,
  notify = null,
}) {
  return {
    id: newId(),
    name,
    price,
    tgId,
    username,
    source,
    inviteStatus,
    inviteCode,
    notify: notify ?? defaultNotifySettings(),
  }
}

export function indexById(students) {
  return new Map(students.map((s) => [s.id, s]))
}

// Бот сможет писать ученику только после того, как тот сам нажал /start.
export function canNotify(student) {
  return student.inviteStatus === INVITE_STATUS.accepted && student.notify?.enabled === true
}

// Приводит ученика из старой схемы к текущей — вызывается при загрузке данных
export function upgradeStudent(s) {
  return {
    ...s,
    source: s.source ?? 'manual',
    inviteStatus: s.inviteStatus ?? INVITE_STATUS.none,
    inviteCode: s.inviteCode ?? null,
    notify: s.notify ?? defaultNotifySettings(),
  }
}
