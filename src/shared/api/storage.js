// Схема v3: у ученика появились статус приглашения и настройки уведомлений.
// v2 и v1 читаем и мигрируем, чтобы ничего не потерялось при обновлении.
const KEY = 'tutor-crm:v3'
const OLD_KEYS = ['tutor-crm:v2', 'tutor-crm-v1']

const EMPTY = { students: [], lessons: [] }

function normalize(parsed) {
  return {
    students: Array.isArray(parsed?.students) ? parsed.students : [],
    lessons: Array.isArray(parsed?.lessons) ? parsed.lessons : [],
  }
}

// Дополняем учеников полями, появившимися в новых версиях схемы.
// upgrade передаёт слой выше: shared не знает про сущности приложения.
let upgradeStudent = (s) => s

export function setStudentUpgrader(fn) {
  upgradeStudent = fn
}

function upgradeStudents(students) {
  return students.map(upgradeStudent)
}

function migrate() {
  for (const oldKey of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(oldKey)
      if (!raw) continue
      const data = normalize(JSON.parse(raw))
      data.students = upgradeStudents(data.students)
      localStorage.setItem(KEY, JSON.stringify(data))
      for (const k of OLD_KEYS) localStorage.removeItem(k)
      return data
    } catch {
      // повреждённый ключ пропускаем и пробуем следующий
    }
  }
  return null
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = normalize(JSON.parse(raw))
      // На случай, если запись сделана сборкой без новых полей
      data.students = upgradeStudents(data.students)
      return data
    }
    return migrate() ?? EMPTY
  } catch {
    // приватный режим Safari / отключённое хранилище
    return EMPTY
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // переполнение квоты или приватный режим — молча пропускаем
  }
}
