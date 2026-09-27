// ВАЖНО: Telegram не даёт Mini App доступ к списку чатов пользователя — такого
// метода нет ни в WebApp SDK, ни в Bot API, это ограничение приватности.
// Реальный список появится на втором этапе: ученик пишет боту /start, бэкенд
// сохраняет chat_id, приложение читает их через API.
//
// Пока отдаём демо-данные, чтобы экран выбора и вся логика вокруг него были
// готовы. Когда появится бэкенд, достаточно заменить тело fetchChats.

const DEMO_CHATS = [
  { tgId: 501234001, name: 'Аня Петрова', username: 'anya_p' },
  { tgId: 501234002, name: 'Борис Смирнов', username: 'boris_s' },
  { tgId: 501234003, name: 'Вика Морозова', username: null },
  { tgId: 501234004, name: 'Глеб Орлов', username: 'gleb_orlov' },
  { tgId: 501234005, name: 'Дарья Ким', username: 'daria_kim' },
  { tgId: 501234006, name: 'Егор Новиков', username: null },
]

export function fetchChats() {
  // На втором этапе: return fetch('/api/chats').then((r) => r.json())
  return Promise.resolve(DEMO_CHATS)
}

export const IS_DEMO = true
